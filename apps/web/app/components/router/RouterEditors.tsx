"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const deviceTypes = ["cpe220", "indoor_ap", "builtin_radio", "other"] as const;
export type DeviceType = (typeof deviceTypes)[number];
export type RouterRow = NonNullable<ReturnType<typeof useQuery<typeof api.routers.listRouters>>>[number];
export type AccessPointRow = NonNullable<ReturnType<typeof useQuery<typeof api.accessPoints.listAccessPoints>>>[number];
export type SwitchRow = NonNullable<ReturnType<typeof useQuery<typeof api.networkSwitches.listSwitches>>>[number];
export type RouterForm = { name: string; location: string; restBaseUrl: string; marketId: string; warning: string; critical: string; memoryWarning: string; memoryCritical: string; username: string; password: string };
export type ApForm = { name: string; port: string; deviceType: DeviceType; sharesPortWith: string; capacity: string; rateLimitReference: string; networkAddress: string; ipAddress: string; macAddress: string; serialNumber: string; model: string; note: string; switchId: string; switchPort: string };
export type SwitchForm = { name: string; model: string; serialNumber: string; macAddress: string; ipAddress: string; routerPort: string; portCount: string; managed: boolean; note: string };

export const emptyRouter = (): RouterForm => ({ name: "", location: "", restBaseUrl: "", marketId: "", warning: "75", critical: "90", memoryWarning: "80", memoryCritical: "90", username: "", password: "" });
export const emptyAp = (): ApForm => ({ name: "", port: "", deviceType: "other", sharesPortWith: "", capacity: "", rateLimitReference: "", networkAddress: "", ipAddress: "", macAddress: "", serialNumber: "", model: "", note: "", switchId: "", switchPort: "" });
export const emptySwitch = (): SwitchForm => ({ name: "", model: "", serialNumber: "", macAddress: "", ipAddress: "", routerPort: "", portCount: "", managed: false, note: "" });
export const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100";
export const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^.*?Error: /, "") : "The change could not be saved.";
export const deviceName = (type: DeviceType) => type === "cpe220" ? "CPE220" : type.replace("_", " ");

function Dialog({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-xl font-semibold">{title}</h2><button className="text-sm text-slate-600" type="button" onClick={close}>Close</button></div>{children}</div></div>;
}

function PortSelect({ routerId, value, onChange, label = "RouterOS interface", required = true }: { routerId: Id<"routers">; value: string; onChange: (value: string) => void; label?: string; required?: boolean }) {
  const getInterfaces = useAction(api.routeros.getInterfaces);
  const telemetry = useQuery(api.operations.getRouterTelemetryLatest, { routerId });
  const [livePorts, setLivePorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setReadError("");
    try {
      const records = (await getInterfaces({ routerId })) as Array<Record<string, unknown>>;
      setLivePorts(records.map((record) => typeof record.name === "string" ? record.name : "").filter((name) => name));
    } catch (caught) {
      setReadError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [getInterfaces, routerId]);

  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  const cachedPorts = useMemo(() => {
    const names: string[] = [];
    const push = (name: string) => { if (name && !names.includes(name)) names.push(name); };
    for (const port of telemetry?.ethernetPorts ?? []) push(port.name);
    for (const radio of telemetry?.wifiRadios ?? []) push(radio.interfaceName ?? "");
    return names;
  }, [telemetry]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const all: string[] = [];
    const add = (name: string) => { if (name && !seen.has(name)) { seen.add(name); all.push(name); } };
    for (const name of livePorts) add(name);
    for (const name of cachedPorts) add(name);
    const rank = (name: string) => /^ether/i.test(name) ? 0 : /^wl/i.test(name) ? 1 : 2;
    return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [livePorts, cachedPorts]);

  const known = value ? options.includes(value) : false;
  const selectValue = known ? value : value ? "__custom__" : "";

  return <div>
    <label className="block text-sm font-medium">{label}{required ? " *" : ""}</label>
    <div className="flex gap-2">
      <select required={required} className={input} value={selectValue} onChange={(e) => { const next = e.target.value; onChange(next === "__custom__" ? "" : next); }}>
        <option value="">Select interface…</option>
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="__custom__">Custom value…</option>
      </select>
      <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600" onClick={() => void refresh()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    {selectValue === "__custom__" ? <input required={required} className={`${input} w-full`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="ether2 or wlan1" /> : null}
    {readError ? <p className="mt-1 text-xs text-red-700">{readError}</p> : null}
    {!readError && livePorts.length === 0 && cachedPorts.length > 0 ? <p className="mt-1 text-xs text-slate-500">Showing ports from the last collector snapshot. Use Refresh to pull the live list from the router.</p> : null}
    {!readError && livePorts.length === 0 && cachedPorts.length === 0 ? <p className="mt-1 text-xs text-slate-500">No ports discovered yet. Start the collector, use Refresh, or pick “Custom value” to type one.</p> : null}
  </div>;
}

function NetworkAddressField({ routerId, value, onChange }: { routerId: Id<"routers">; value: string; onChange: (value: string) => void }) {
  const getIpAddresses = useAction(api.routeros.getIpAddresses);
  const [networks, setNetworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setReadError("");
    try {
      const raw = await getIpAddresses({ routerId });
      const records = Array.isArray(raw) ? raw : [raw];
      const seen = new Set<string>();
      const next: string[] = [];
      for (const record of records) {
        const address = typeof record.address === "string" ? record.address : "";
        const network = typeof record.network === "string" && record.network.trim() ? record.network : "";
        const prefix = address.includes("/") ? address.split("/")[1] : "";
        const candidate = network ? (prefix ? `${network}/${prefix}` : network) : address;
        if (candidate && !seen.has(candidate)) { seen.add(candidate); next.push(candidate); }
      }
      setNetworks(next.sort((a, b) => a.localeCompare(b)));
    } catch (caught) {
      setReadError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [getIpAddresses, routerId]);

  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  const known = value ? networks.includes(value) : false;
  const selectValue = known ? value : value ? "__custom__" : "";

  return <div>
    <label className="block text-sm font-medium">Network address</label>
    <div className="flex gap-2">
      <select className={input} value={selectValue} onChange={(e) => { const next = e.target.value; onChange(next === "__custom__" ? "" : next); }}>
        <option value="">Select network…</option>
        {networks.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="__custom__">Custom value…</option>
      </select>
      <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600" onClick={() => void refresh()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
    </div>
    {selectValue === "__custom__" ? <input className={`${input} w-full`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="192.168.5.0/24" /> : null}
    {readError ? <p className="mt-1 text-xs text-red-700">{readError}</p> : null}
    {!readError && networks.length === 0 ? <p className="mt-1 text-xs text-slate-500">No subnets discovered yet. Use Refresh to pull them from the router, or pick “Custom value”.</p> : null}
  </div>;
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return <fieldset className="rounded border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">{legend}</legend>{children}</fieldset>;
}

export function RouterEditor({ router, markets, close, done }: { router?: RouterRow; markets: NonNullable<ReturnType<typeof useQuery<typeof api.markets.listMarkets>>>; close: () => void; done: (message: string) => void }) {
  const add = useMutation(api.routers.addRouter); const update = useMutation(api.routers.updateRouter); const rotate = useMutation(api.routers.updateRouterCredentials);
  const [form, setForm] = useState<RouterForm>(() => router ? { name: router.name, location: router.location, restBaseUrl: router.restBaseUrl, marketId: router.marketId ?? "", warning: String(router.cpuWarningThreshold ?? 75), critical: String(router.cpuCriticalThreshold ?? 90), memoryWarning: String(router.memoryWarningThreshold ?? 80), memoryCritical: String(router.memoryCriticalThreshold ?? 90), username: "", password: "" } : emptyRouter());
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setSaving(true); try {
    const common = { name: form.name, location: form.location, restBaseUrl: form.restBaseUrl, marketId: form.marketId ? form.marketId as Id<"markets"> : undefined, cpuWarningThreshold: Number(form.warning), cpuCriticalThreshold: Number(form.critical) };
    if (router) { await update({ routerId: router._id, ...common }); if (form.username || form.password) { if (!form.username || !form.password) throw new Error("Enter both username and password to rotate credentials."); await rotate({ routerId: router._id, username: form.username, password: form.password }); } done("Router inventory updated."); }
    else { if (!form.username || !form.password) throw new Error("A dedicated read-only RouterOS username and password are required."); await add({ ...common, username: form.username, password: form.password }); done("Router added. Copy its identifier into the local collector before expecting telemetry."); }
    close();
  } catch (caught) { setError(errorText(caught)); } finally { setSaving(false); } };
  return <Dialog title={router ? "Edit router" : "Add router"} close={close}><form className="space-y-4" onSubmit={submit}>{error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Router name<input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="text-sm font-medium">Location<input required className={input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label></div><label className="block text-sm font-medium">Market<select className={input} value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })}><option value="">Unassigned</option>{markets.map((market) => <option key={market._id} value={market._id}>{market.name}</option>)}</select></label><label className="block text-sm font-medium">RouterOS HTTPS origin<input required type="url" className={input} value={form.restBaseUrl} onChange={(e) => setForm({ ...form, restBaseUrl: e.target.value })} placeholder="https://192.168.1.1:8443" /><span className="mt-1 block text-xs font-normal text-slate-500">Use an HTTPS origin only. The local collector—not this browser—connects to it.</span></label><fieldset className="rounded border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">Alert thresholds</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">CPU warning (%)<input required min="1" max="99" type="number" className={input} value={form.warning} onChange={(e) => setForm({ ...form, warning: e.target.value })} /></label><label className="text-sm font-medium">CPU critical (%)<input required min="2" max="100" type="number" className={input} value={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.value })} /></label><label className="text-sm font-medium">Memory warning (%)<input required min="1" max="99" type="number" className={input} value={form.memoryWarning} onChange={(e) => setForm({ ...form, memoryWarning: e.target.value })} /></label><label className="text-sm font-medium">Memory critical (%)<input required min="2" max="100" type="number" className={input} value={form.memoryCritical} onChange={(e) => setForm({ ...form, memoryCritical: e.target.value })} /></label></div></fieldset><fieldset className="rounded border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">{router ? "RouterOS credentials" : "Collector credentials (RouterOS login)"}</legend>{router && (router.hasCredentials ? <p className="mb-2 text-xs font-medium text-emerald-700">Collector credentials are stored (encrypted). Leave both fields blank to keep them unchanged.</p> : <p className="mb-2 text-xs font-medium text-red-700">No collector credentials yet - enter the RouterOS username and password below to let the collector connect.</p>)}<p className="mb-3 text-xs text-slate-500">The collector logs in with a dedicated read-only RouterOS user over HTTPS (e.g. username &quot;api&quot;). Credentials are stored encrypted and never shown again.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">RouterOS username<input className={input} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={router ? "Leave blank unless rotating" : "readonly" } /></label><label className="text-sm font-medium">RouterOS password<input className={input} autoComplete="new-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={router ? "Leave blank unless rotating" : "•".repeat(8)} /></label></div></fieldset><div className="flex justify-end gap-3"><button type="button" className="rounded border px-4 py-2 text-sm" onClick={close}>Cancel</button><button disabled={saving} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : router ? "Save changes" : "Add router"}</button></div></form></Dialog>;
}

export function ApEditor({ accessPoint, routerId, close, done }: { accessPoint?: AccessPointRow; routerId: Id<"routers">; close: () => void; done: (message: string) => void }) {
  const add = useMutation(api.accessPoints.addAccessPoint); const update = useMutation(api.accessPoints.updateAccessPoint);
  const switchRows = useQuery(api.networkSwitches.listSwitches, { routerId });
  const [form, setForm] = useState<ApForm>(() => accessPoint ? { name: accessPoint.name, port: accessPoint.port, deviceType: accessPoint.deviceType, sharesPortWith: accessPoint.sharesPortWith ?? "", capacity: accessPoint.capacity ? String(accessPoint.capacity) : "", rateLimitReference: accessPoint.rateLimitReference ?? "", networkAddress: accessPoint.networkAddress ?? "", ipAddress: accessPoint.ipAddress ?? "", macAddress: accessPoint.macAddress ?? "", serialNumber: accessPoint.serialNumber ?? "", model: accessPoint.model ?? "", note: accessPoint.note ?? "", switchId: accessPoint.switchId ?? "", switchPort: accessPoint.switchPort ?? "" } : emptyAp());
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setSaving(true); try {
    const details = { name: form.name, port: form.port, deviceType: form.deviceType, sharesPortWith: form.sharesPortWith || undefined, capacity: form.capacity ? Number(form.capacity) : undefined, rateLimitReference: form.rateLimitReference || undefined, networkAddress: form.networkAddress || undefined, ipAddress: form.ipAddress || undefined, macAddress: form.macAddress || undefined, serialNumber: form.serialNumber || undefined, model: form.model || undefined, note: form.note || undefined, switchId: form.switchId ? form.switchId as Id<"networkSwitches"> : undefined, switchPort: form.switchPort || undefined };
    if (accessPoint) await update({ accessPointId: accessPoint._id, ...details }); else await add({ routerId, ...details });
    done(accessPoint ? "Access point updated." : "Access point registered."); close();
  } catch (caught) { setError(errorText(caught)); } finally { setSaving(false); } };
  const switches = switchRows ?? [];
  const linkedSwitchName = switches.find((entry) => entry._id === form.switchId)?.name;
  return <Dialog title={accessPoint ? "Edit access point" : "Add access point"} close={close}><form className="space-y-4" onSubmit={submit}>{error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Fieldset legend="Identity"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Name<input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="text-sm font-medium">Device type<select className={input} value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value as DeviceType })}>{deviceTypes.map((type) => <option key={type} value={type}>{deviceName(type)}</option>)}</select></label><label className="text-sm font-medium">Model<input className={input} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. CPE220" /></label><label className="text-sm font-medium">Serial number<input className={input} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Optional" /></label></div></Fieldset>
    <Fieldset legend="Network"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><PortSelect routerId={routerId} value={form.port} onChange={(port) => setForm({ ...form, port })} /></div><div className="sm:col-span-2"><NetworkAddressField routerId={routerId} value={form.networkAddress} onChange={(networkAddress) => setForm({ ...form, networkAddress })} /></div><label className="text-sm font-medium">Access point IP address<input className={input} value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.5.2" /></label><label className="text-sm font-medium">MAC address<input className={input} value={form.macAddress} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" /></label></div></Fieldset>
    <Fieldset legend="Switch connection">{switches.length === 0 ? <p className="text-xs text-slate-500">No switches are registered for this router yet. Add one from the Switches tab of the router console, then come back to link this access point to it.</p> : <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Switch<select className={input} value={form.switchId} onChange={(e) => setForm({ ...form, switchId: e.target.value })}><option value="">None — direct to router port</option>{switches.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}</select></label><label className="text-sm font-medium">Switch port<input className={input} value={form.switchPort} onChange={(e) => setForm({ ...form, switchPort: e.target.value })} placeholder={linkedSwitchName ? `Port on ${linkedSwitchName}` : "Optional"} disabled={!form.switchId} /></label></div>}</Fieldset>
    <Fieldset legend="Service & limits"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Safe user capacity<input min="1" type="number" className={input} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Optional" /></label><label className="text-sm font-medium">Shared port note<input className={input} value={form.sharesPortWith} onChange={(e) => setForm({ ...form, sharesPortWith: e.target.value })} /></label><label className="text-sm font-medium">Rate-limit reference<input className={input} value={form.rateLimitReference} onChange={(e) => setForm({ ...form, rateLimitReference: e.target.value })} /></label></div></Fieldset>
    <label className="block text-sm font-medium">Note<textarea className={`${input} min-h-[72px]`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional - tower, antenna, PoE source, remaining IPs, etc." /></label>
    <div className="flex justify-end gap-3"><button type="button" className="rounded border px-4 py-2 text-sm" onClick={close}>Cancel</button><button disabled={saving} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save access point"}</button></div></form></Dialog>;
}

export function SwitchEditor({ switchRow, routerId, close, done }: { switchRow?: SwitchRow; routerId: Id<"routers">; close: () => void; done: (message: string) => void }) {
  const add = useMutation(api.networkSwitches.addSwitch); const update = useMutation(api.networkSwitches.updateSwitch);
  const [form, setForm] = useState<SwitchForm>(() => switchRow ? { name: switchRow.name, model: switchRow.model ?? "", serialNumber: switchRow.serialNumber ?? "", macAddress: switchRow.macAddress ?? "", ipAddress: switchRow.ipAddress ?? "", routerPort: switchRow.routerPort ?? "", portCount: switchRow.portCount ? String(switchRow.portCount) : "", managed: switchRow.managed ?? false, note: switchRow.note ?? "" } : emptySwitch());
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setSaving(true); try {
    const details = { name: form.name, model: form.model || undefined, serialNumber: form.serialNumber || undefined, macAddress: form.macAddress || undefined, ipAddress: form.ipAddress || undefined, routerPort: form.routerPort || undefined, portCount: form.portCount ? Number(form.portCount) : undefined, managed: form.managed, note: form.note || undefined };
    if (switchRow) await update({ switchId: switchRow._id, ...details }); else await add({ routerId, ...details });
    done(switchRow ? "Switch updated." : "Switch registered."); close();
  } catch (caught) { setError(errorText(caught)); } finally { setSaving(false); } };
  return <Dialog title={switchRow ? "Edit switch" : "Add switch"} close={close}><form className="space-y-4" onSubmit={submit}>{error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Switch name<input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SW-Tayari-1" /></label><label className="text-sm font-medium">Model<input className={input} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. CRS112-8G" /></label><label className="text-sm font-medium">Serial number<input className={input} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Optional" /></label><label className="text-sm font-medium">MAC address<input className={input} value={form.macAddress} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" /></label><label className="text-sm font-medium">Switch IP address<input className={input} value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.1.2" /></label><label className="text-sm font-medium">Port count<input min="1" type="number" className={input} value={form.portCount} onChange={(e) => setForm({ ...form, portCount: e.target.value })} placeholder="Optional" /></label></div>
    <PortSelect routerId={routerId} value={form.routerPort} onChange={(routerPort) => setForm({ ...form, routerPort })} label="Router port (uplink)" required={false} />
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4" checked={form.managed} onChange={(e) => setForm({ ...form, managed: e.target.checked })} />Managed switch (configurable via RouterOS/Winbox)</label>
    <label className="block text-sm font-medium">Note<textarea className={`${input} min-h-[72px]`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional - which access points hang off it, PoE budget, rack location, etc." /></label>
    <div className="flex justify-end gap-3"><button type="button" className="rounded border px-4 py-2 text-sm" onClick={close}>Cancel</button><button disabled={saving} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save switch"}</button></div></form></Dialog>;
}
