"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X, Save, Trash2, AlertTriangle } from "lucide-react";
import { withRetry } from "../../hooks/useConvexMutation";

interface SwitchEditorProps {
  switchId: Id<"networkSwitches">;
  routerId: Id<"routers">;
  onClose: () => void;
  onSuccess: () => void;
}

export function SwitchEditor({ switchId, routerId, onClose, onSuccess }: SwitchEditorProps) {
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    serialNumber: "",
    macAddress: "",
    ipAddress: "",
    routerPort: "",
    portCount: "",
    managed: false,
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const switchData = useQuery(api.networkSwitches.listSwitches, { routerId });
  const currentSwitch = switchData?.find(s => s._id === switchId);

  const updateSwitch = useMutation(api.networkSwitches.updateSwitch);
  const deleteSwitch = useMutation(api.networkSwitches.deleteSwitch);

  // Initialize form with current switch data when switch data loads
  if (currentSwitch && formData.name === "") {
    setFormData({
      name: currentSwitch.name,
      model: currentSwitch.model || "",
      serialNumber: currentSwitch.serialNumber || "",
      macAddress: currentSwitch.macAddress || "",
      ipAddress: currentSwitch.ipAddress || "",
      routerPort: currentSwitch.routerPort || "",
      portCount: currentSwitch.portCount?.toString() || "",
      managed: currentSwitch.managed || false,
      note: currentSwitch.note || "",
    });
  }

  if (!currentSwitch) {
    return <div className="loading-panel">Loading switch data...</div>;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Switch name is required";
    }
    if (formData.name.length > 160) {
      newErrors.name = "Name must be less than 160 characters";
    }

    if (formData.macAddress && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(formData.macAddress)) {
      newErrors.macAddress = "Invalid MAC address format (AA:BB:CC:DD:EE:FF)";
    }

    if (formData.ipAddress) {
      const octets = formData.ipAddress.split(".");
      if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) {
        newErrors.ipAddress = "Invalid IPv4 address";
      }
    }

    if (formData.portCount && (isNaN(Number(formData.portCount)) || Number(formData.portCount) < 1 || Number(formData.portCount) > 1000)) {
      newErrors.portCount = "Port count must be between 1 and 1000";
    }

    if (formData.model && formData.model.length > 120) {
      newErrors.model = "Model must be less than 120 characters";
    }

    if (formData.serialNumber && formData.serialNumber.length > 120) {
      newErrors.serialNumber = "Serial number must be less than 120 characters";
    }

    if (formData.routerPort && formData.routerPort.length > 80) {
      newErrors.routerPort = "Router port must be less than 80 characters";
    }

    if (formData.note && formData.note.length > 1000) {
      newErrors.note = "Note must be less than 1000 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await withRetry(async () => {
        await updateSwitch({
          switchId,
          name: formData.name.trim(),
          model: formData.model.trim() || undefined,
          serialNumber: formData.serialNumber.trim() || undefined,
          macAddress: formData.macAddress.trim() || undefined,
          ipAddress: formData.ipAddress.trim() || undefined,
          routerPort: formData.routerPort.trim() || undefined,
          portCount: formData.portCount ? Number(formData.portCount) : undefined,
          managed: formData.managed,
          note: formData.note.trim() || undefined,
        });
      }, { maxRetries: 3, retryDelay: 1000 });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update switch:", error);
      setErrors({ submit: "Failed to update switch. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await withRetry(async () => {
        await deleteSwitch({
          switchId,
          reason: "Deleted by operator",
        });
      }, { maxRetries: 3, retryDelay: 1000 });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to delete switch:", error);
      setErrors({ submit: "Failed to delete switch. Please try again." });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!currentSwitch) {
    return <div className="loading-panel">Loading switch data...</div>;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit switch">
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>Edit Switch</h2>
          <button 
            type="button" 
            className="icon-button" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Switch Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "input-error" : ""}
              maxLength={160}
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="model">Model</label>
            <input
              id="model"
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={errors.model ? "input-error" : ""}
              maxLength={120}
              placeholder="e.g., Netis GS-105"
            />
            {errors.model && <span className="error-text">{errors.model}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="serialNumber">Serial Number</label>
              <input
                id="serialNumber"
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className={errors.serialNumber ? "input-error" : ""}
                maxLength={120}
                placeholder="Device serial number"
              />
              {errors.serialNumber && <span className="error-text">{errors.serialNumber}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="portCount">Port Count</label>
              <input
                id="portCount"
                type="number"
                value={formData.portCount}
                onChange={(e) => setFormData({ ...formData, portCount: e.target.value })}
                className={errors.portCount ? "input-error" : ""}
                min="1"
                max="1000"
                placeholder="e.g., 5"
              />
              {errors.portCount && <span className="error-text">{errors.portCount}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="macAddress">MAC Address</label>
              <input
                id="macAddress"
                type="text"
                value={formData.macAddress}
                onChange={(e) => setFormData({ ...formData, macAddress: e.target.value.toUpperCase() })}
                className={errors.macAddress ? "input-error" : ""}
                placeholder="AA:BB:CC:DD:EE:FF"
              />
              {errors.macAddress && <span className="error-text">{errors.macAddress}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="ipAddress">Management IP</label>
              <input
                id="ipAddress"
                type="text"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                className={errors.ipAddress ? "input-error" : ""}
                placeholder="192.168.1.1"
              />
              {errors.ipAddress && <span className="error-text">{errors.ipAddress}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="routerPort">Router Port</label>
            <input
              id="routerPort"
              type="text"
              value={formData.routerPort}
              onChange={(e) => setFormData({ ...formData, routerPort: e.target.value })}
              className={errors.routerPort ? "input-error" : ""}
              maxLength={80}
              placeholder="e.g., ether5"
            />
            {errors.routerPort && <span className="error-text">{errors.routerPort}</span>}
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.managed}
                onChange={(e) => setFormData({ ...formData, managed: e.target.checked })}
              />
              <span>Managed Switch</span>
            </label>
            <small>Enable if this switch supports SNMP/management protocols</small>
          </div>

          <div className="form-group">
            <label htmlFor="note">Notes</label>
            <textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className={errors.note ? "input-error" : ""}
              maxLength={1000}
              rows={3}
              placeholder="Additional notes about this switch..."
            />
            {errors.note && <span className="error-text">{errors.note}</span>}
          </div>

          {errors.submit && <div className="error-banner">{errors.submit}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {showDeleteConfirm ? (
                <>
                  <AlertTriangle size={16} />
                  Confirm Delete
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete Switch
                </>
              )}
            </button>
            <div className="action-spacer" />
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              <Save size={16} />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
