"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X, Plus, Save } from "lucide-react";
import { withRetry } from "../../hooks/useConvexMutation";

interface AccessPointEditorProps {
  accessPointId?: Id<"accessPoints">;
  routerId: Id<"routers">;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccessPointEditor({ accessPointId, routerId, onClose, onSuccess }: AccessPointEditorProps) {
  const [formData, setFormData] = useState({
    name: "",
    port: "",
    deviceType: "cpe220" as "cpe220" | "indoor_ap" | "builtin_radio" | "other",
    sharesPortWith: "",
    capacity: "",
    rateLimitReference: "",
    networkAddress: "",
    ipAddress: "",
    macAddress: "",
    serialNumber: "",
    model: "",
    note: "",
    switchId: "",
    switchPort: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCreating = !accessPointId;

  const accessPoints = useQuery(api.accessPoints.listAccessPoints, { routerId });
  const currentAccessPoint = accessPointId ? accessPoints?.find(ap => ap._id === accessPointId) : null;
  const switches = useQuery(api.networkSwitches.listSwitches, { routerId });

  const addAccessPoint = useMutation(api.accessPoints.addAccessPoint);
  const updateAccessPoint = useMutation(api.accessPoints.updateAccessPoint);

  // Initialize form with current access point data when editing
  if (currentAccessPoint && formData.name === "") {
    setFormData({
      name: currentAccessPoint.name,
      port: currentAccessPoint.port,
      deviceType: currentAccessPoint.deviceType,
      sharesPortWith: currentAccessPoint.sharesPortWith || "",
      capacity: currentAccessPoint.capacity?.toString() || "",
      rateLimitReference: currentAccessPoint.rateLimitReference || "",
      networkAddress: currentAccessPoint.networkAddress || "",
      ipAddress: currentAccessPoint.ipAddress || "",
      macAddress: currentAccessPoint.macAddress || "",
      serialNumber: currentAccessPoint.serialNumber || "",
      model: currentAccessPoint.model || "",
      note: currentAccessPoint.note || "",
      switchId: currentAccessPoint.switchId || "",
      switchPort: currentAccessPoint.switchPort || "",
    });
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Access point name is required";
    }
    if (formData.name.length > 160) {
      newErrors.name = "Name must be less than 160 characters";
    }

    if (!formData.port.trim()) {
      newErrors.port = "RouterOS interface is required";
    }
    if (formData.port.length > 80) {
      newErrors.port = "Interface must be less than 80 characters";
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

    if (formData.capacity && (isNaN(Number(formData.capacity)) || Number(formData.capacity) < 1 || Number(formData.capacity) > 10000)) {
      newErrors.capacity = "Capacity must be between 1 and 10,000";
    }

    if (formData.rateLimitReference && formData.rateLimitReference.length > 160) {
      newErrors.rateLimitReference = "Rate limit reference must be less than 160 characters";
    }

    if (formData.networkAddress && formData.networkAddress.length > 64) {
      newErrors.networkAddress = "Network address must be less than 64 characters";
    }

    if (formData.serialNumber && formData.serialNumber.length > 120) {
      newErrors.serialNumber = "Serial number must be less than 120 characters";
    }

    if (formData.model && formData.model.length > 120) {
      newErrors.model = "Model must be less than 120 characters";
    }

    if (formData.note && formData.note.length > 1000) {
      newErrors.note = "Note must be less than 1000 characters";
    }

    if (formData.sharesPortWith && formData.sharesPortWith.length > 160) {
      newErrors.sharesPortWith = "Shared port reference must be less than 160 characters";
    }

    if (formData.switchPort && formData.switchPort.length > 80) {
      newErrors.switchPort = "Switch port must be less than 80 characters";
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
      const baseData = {
        routerId,
        name: formData.name.trim(),
        port: formData.port.trim(),
        deviceType: formData.deviceType,
        sharesPortWith: formData.sharesPortWith.trim() || undefined,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
        rateLimitReference: formData.rateLimitReference.trim() || undefined,
        networkAddress: formData.networkAddress.trim() || undefined,
        ipAddress: formData.ipAddress.trim() || undefined,
        macAddress: formData.macAddress.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        model: formData.model.trim() || undefined,
        note: formData.note.trim() || undefined,
        switchId: formData.switchId ? formData.switchId as Id<"networkSwitches"> : undefined,
        switchPort: formData.switchPort.trim() || undefined,
      };

      if (isCreating) {
        await withRetry(async () => {
          await addAccessPoint(baseData);
        }, { maxRetries: 3, retryDelay: 1000 });
      } else {
        await withRetry(async () => {
          await updateAccessPoint({
            accessPointId: accessPointId as Id<"accessPoints">,
            ...baseData,
          });
        }, { maxRetries: 3, retryDelay: 1000 });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save access point:", error);
      setErrors({ submit: `Failed to ${isCreating ? 'create' : 'update'} access point. Please try again.` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isCreating ? "Create access point" : "Edit access point"}>
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>{isCreating ? "Create Access Point" : "Edit Access Point"}</h2>
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
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Access Point Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? "input-error" : ""}
                maxLength={160}
                required
                placeholder="e.g., Tayari AP1"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="port">RouterOS Interface *</label>
              <input
                id="port"
                type="text"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                className={errors.port ? "input-error" : ""}
                maxLength={80}
                required
                placeholder="e.g., ether2"
              />
              {errors.port && <span className="error-text">{errors.port}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="deviceType">Device Type *</label>
              <select
                id="deviceType"
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as "cpe220" | "indoor_ap" | "builtin_radio" | "other" })}
                required
              >
                <option value="cpe220">CPE220</option>
                <option value="indoor_ap">Indoor AP</option>
                <option value="builtin_radio">Built-in Radio</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="capacity">Capacity (users)</label>
              <input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className={errors.capacity ? "input-error" : ""}
                min="1"
                max="10000"
                placeholder="e.g., 50"
              />
              {errors.capacity && <span className="error-text">{errors.capacity}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sharesPortWith">Shares Port With</label>
            <input
              id="sharesPortWith"
              type="text"
              value={formData.sharesPortWith}
              onChange={(e) => setFormData({ ...formData, sharesPortWith: e.target.value })}
              className={errors.sharesPortWith ? "input-error" : ""}
              maxLength={160}
              placeholder="Reference to another AP sharing this port"
            />
            {errors.sharesPortWith && <span className="error-text">{errors.sharesPortWith}</span>}
            <small>Use when multiple access points share the same RouterOS interface</small>
          </div>

          <div className="form-group">
            <label htmlFor="rateLimitReference">Rate Limit Reference</label>
            <input
              id="rateLimitReference"
              type="text"
              value={formData.rateLimitReference}
              onChange={(e) => setFormData({ ...formData, rateLimitReference: e.target.value })}
              className={errors.rateLimitReference ? "input-error" : ""}
              maxLength={160}
              placeholder="e.g., 10Mbps-plan"
            />
            {errors.rateLimitReference && <span className="error-text">{errors.rateLimitReference}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ipAddress">IP Address</label>
              <input
                id="ipAddress"
                type="text"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                className={errors.ipAddress ? "input-error" : ""}
                placeholder="192.168.0.1"
              />
              {errors.ipAddress && <span className="error-text">{errors.ipAddress}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="networkAddress">Network Address</label>
              <input
                id="networkAddress"
                type="text"
                value={formData.networkAddress}
                onChange={(e) => setFormData({ ...formData, networkAddress: e.target.value })}
                className={errors.networkAddress ? "input-error" : ""}
                maxLength={64}
                placeholder="e.g., 10.0.0.0/24"
              />
              {errors.networkAddress && <span className="error-text">{errors.networkAddress}</span>}
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
              placeholder="e.g., Mikrotik cAP ac"
            />
            {errors.model && <span className="error-text">{errors.model}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="switchId">Switch</label>
              <select
                id="switchId"
                value={formData.switchId}
                onChange={(e) => setFormData({ ...formData, switchId: e.target.value })}
              >
                <option value="">Direct to router</option>
                {switches?.map(sw => (
                  <option key={sw._id} value={sw._id}>{sw.name}</option>
                ))}
              </select>
              <small>Select if this AP connects via a network switch</small>
            </div>

            <div className="form-group">
              <label htmlFor="switchPort">Switch Port</label>
              <input
                id="switchPort"
                type="text"
                value={formData.switchPort}
                onChange={(e) => setFormData({ ...formData, switchPort: e.target.value })}
                className={errors.switchPort ? "input-error" : ""}
                maxLength={80}
                placeholder="e.g., port 1"
                disabled={!formData.switchId}
              />
              {errors.switchPort && <span className="error-text">{errors.switchPort}</span>}
            </div>
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
              placeholder="Additional notes about this access point..."
            />
            {errors.note && <span className="error-text">{errors.note}</span>}
          </div>

          {errors.submit && <div className="error-banner">{errors.submit}</div>}

          <div className="modal-actions">
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
              {isCreating ? <Plus size={16} /> : <Save size={16} />}
              {isSubmitting ? "Saving..." : isCreating ? "Create Access Point" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
