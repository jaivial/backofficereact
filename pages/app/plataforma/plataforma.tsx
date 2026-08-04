import { useCallback, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { platformAPI } from "../../../api/platform-client";
import type {
  PlatformDashboard,
  PlatformRestaurant,
  PlatformUser,
  PlatformSubscription,
  PlatformWhatsAppInstance,
  PlatformDomain,
  PlatformUAZAPIServer,
} from "../../../api/platform-client";
import type { Data } from "./+data";

type Tab = "dashboard" | "restaurants" | "users" | "subscriptions" | "whatsapp" | "stripe" | "domains" | "servers";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "restaurants", label: "Restaurantes" },
  { key: "users", label: "Usuarios" },
  { key: "subscriptions", label: "Suscripciones" },
  { key: "whatsapp", label: "WhatsApp / QR" },
  { key: "stripe", label: "Stripe" },
  { key: "domains", label: "Dominios" },
  { key: "servers", label: "Servidores" },
];

const EMPTY_DATA: Data = { dashboard: null, error: null };

export default function Page() {
  const pageContext = usePageContext();
  const initialData = (pageContext.data ?? EMPTY_DATA) as Data;
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="bo-platformPage" data-ui="platform-page">
      <header className="bo-platformHeader">
        <h1 className="bo-platformTitle">Panel de Plataforma</h1>
        <p className="bo-platformSub">Gestion de todos los restaurantes y cuentas</p>
      </header>

      <nav className="bo-platformTabs" data-ui="platform-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`bo-platformTab ${tab === t.key ? "is-active" : ""}`}
            data-ui={`platform-tab-${t.key}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="bo-platformContent">
        {tab === "dashboard" && <DashboardTab initialData={initialData} />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "whatsapp" && <WhatsAppTab />}
        {tab === "stripe" && <StripeTab />}
        {tab === "domains" && <DomainsTab />}
        {tab === "servers" && <ServersTab />}
      </div>
    </div>
  );
}

// ============ Dashboard Tab ============

function DashboardTab({ initialData }: { initialData: Data }) {
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(initialData.dashboard);

  const refresh = useCallback(async () => {
    const d = await platformAPI.getDashboard();
    setDashboard(d);
  }, []);

  useEffect(() => {
    if (!dashboard) void refresh();
  }, [dashboard, refresh]);

  if (!dashboard) {
    return <div className="bo-platformLoading">Cargando metricas...</div>;
  }

  const m = dashboard.metrics;
  const cards = [
    { label: "Restaurantes", value: m.restaurants, icon: "🍽" },
    { label: "Usuarios", value: m.users, icon: "👥" },
    { label: "Superadmins", value: m.superadmins, icon: "🔑" },
    { label: "Sesiones Activas", value: m.activeSessions, icon: "🟢" },
    { label: "Suscripciones", value: m.activeSubscriptions + "/" + m.subscriptions, icon: "🔄" },
    { label: "Dominios", value: m.domains, icon: "🌐" },
    { label: "Instancias WhatsApp", value: m.whatsappInstances, icon: "💬" },
    { label: "MRR Estimado", value: m.monthlyRecurringRevenue.toFixed(2) + " EUR", icon: "💰" },
  ];

  return (
    <div className="bo-platformDashboard" data-ui="platform-dashboard">
      <div className="bo-metricGrid">
        {cards.map((c) => (
          <div key={c.label} className="bo-metricCard" data-ui="metric-card">
            <div className="bo-metricIcon">{c.icon}</div>
            <div className="bo-metricValue">{c.value}</div>
            <div className="bo-metricLabel">{c.label}</div>
          </div>
        ))}
      </div>
      <button className="bo-platformRefresh" onClick={() => void refresh()} data-ui="dashboard-refresh">
        Actualizar
      </button>
    </div>
  );
}

// ============ Restaurants Tab ============

function RestaurantsTab() {
  const [restaurants, setRestaurants] = useState<PlatformRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listRestaurants();
      setRestaurants(res.restaurants ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDeactivate = async (id: number) => {
    if (!confirm("Suspender este restaurante? Se cerraran sesiones, suscripciones y WhatsApp.")) return;
    const res = await platformAPI.deactivateRestaurant(id);
    alert(res.message);
    void load();
  };

  const handleActivate = async (id: number) => {
    const res = await platformAPI.activateRestaurant(id);
    alert(res.message);
    void load();
  };

  return (
    <div data-ui="restaurants-tab">
      <div className="bo-platformActionBar">
        <button className="bo-platformBtn" onClick={() => setShowCreate(!showCreate)} data-ui="restaurant-create-toggle">
          {showCreate ? "Cancelar" : "+ Nuevo Restaurante"}
        </button>
      </div>

      {showCreate && <CreateRestaurantForm onCreated={() => { setShowCreate(false); void load(); }} />}

      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable" data-ui="restaurants-table">
            <thead>
              <tr>
                <th>ID</th><th>Slug</th><th>Nombre</th><th>Usuarios</th><th>Miembros</th>
                <th>Reservas</th><th>Dominios</th><th>WhatsApp</th><th>Creado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id} data-ui={`restaurant-row-${r.id}`}>
                  <td>{r.id}</td>
                  <td><code>{r.slug}</code></td>
                  <td>{r.name}</td>
                  <td>{r.userCount}</td>
                  <td>{r.memberCount}</td>
                  <td>{r.bookingCount}</td>
                  <td>{r.domainCount}</td>
                  <td><WhatsAppBadge status={r.whatsappStatus} /></td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="bo-platformActions">
                      {r.isActive ? (
                        <button className="bo-platformBtn bo-platformBtn--danger" onClick={() => void handleDeactivate(r.id)} data-ui={`restaurant-deactivate-${r.id}`}>
                          Suspender
                        </button>
                      ) : (
                        <button className="bo-platformBtn bo-platformBtn--success" onClick={() => void handleActivate(r.id)} data-ui={`restaurant-activate-${r.id}`}>
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateRestaurantForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await platformAPI.createRestaurant({ slug, name, contactEmail: email, contactPhone: phone });
      if (!res.success) { setError(res.message ?? "Error"); return; }
      setSlug(""); setName(""); setEmail(""); setPhone("");
      onCreated();
    } finally { setLoading(false); }
  };

  return (
    <div className="bo-platformForm" data-ui="restaurant-create-form">
      <input className="bo-platformInput" placeholder="Slug (ej: mi-restaurante)" value={slug} onChange={(e) => setSlug(e.target.value)} data-ui="restaurant-create-slug" />
      <input className="bo-platformInput" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} data-ui="restaurant-create-name" />
      <input className="bo-platformInput" placeholder="Email contacto" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="bo-platformInput" placeholder="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <div className="bo-platformError">{error}</div>}
      <button className="bo-platformBtn" disabled={loading || !slug || !name} onClick={() => void submit()} data-ui="restaurant-create-submit">
        {loading ? "Creando..." : "Crear"}
      </button>
    </div>
  );
}

// ============ Users Tab ============

function UsersTab() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listUsers();
      setUsers(res.users ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleResetPassword = async (id: number, name: string) => {
    const pw = prompt(`Nueva password para ${name} (min 6 caracteres):`);
    if (!pw || pw.length < 6) { if (pw !== null) alert("Minimo 6 caracteres"); return; }
    const res = await platformAPI.resetUserPassword(id, pw);
    alert(res.message);
  };

  const handleRevokeSessions = async (id: number, name: string) => {
    if (!confirm(`Revocar todas las sesiones de ${name}?`)) return;
    const res = await platformAPI.revokeUserSessions(id);
    alert(res.message);
    void load();
  };

  const handleToggleSuper = async (u: PlatformUser) => {
    await platformAPI.patchUser(u.id, { isSuperadmin: !u.isSuperadmin });
    void load();
  };

  return (
    <div data-ui="users-tab">
      <div className="bo-platformActionBar">
        <button className="bo-platformBtn" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancelar" : "+ Nuevo Usuario"}
        </button>
      </div>

      {showCreate && <CreateUserForm onCreated={() => { setShowCreate(false); void load(); }} />}

      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable" data-ui="users-table">
            <thead>
              <tr>
                <th>ID</th><th>Email</th><th>Nombre</th><th>Superadmin</th>
                <th>Sesiones</th><th>Restaurantes</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-ui={`user-row-${u.id}`}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>
                    <button className={`bo-platformToggle ${u.isSuperadmin ? "is-on" : ""}`} onClick={() => void handleToggleSuper(u)} data-ui={`user-toggle-super-${u.id}`}>
                      {u.isSuperadmin ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td>{u.activeSessionCount}</td>
                  <td>{u.restaurants.map((r) => `${r.restaurantName} (${r.role})`).join(", ") || "-"}</td>
                  <td>
                    <div className="bo-platformActions">
                      <button className="bo-platformBtn" onClick={() => void handleResetPassword(u.id, u.name)} data-ui={`user-reset-pw-${u.id}`}>
                        Reset PW
                      </button>
                      <button className="bo-platformBtn bo-platformBtn--danger" onClick={() => void handleRevokeSessions(u.id, u.name)} data-ui={`user-revoke-${u.id}`}>
                        Revocar Sesiones
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await platformAPI.createUser({ email, name, password, isSuperadmin: isSuper });
      if (!res.success) { setError(res.message ?? "Error"); return; }
      setEmail(""); setName(""); setPassword(""); setIsSuper(false);
      onCreated();
    } finally { setLoading(false); }
  };

  return (
    <div className="bo-platformForm" data-ui="user-create-form">
      <input className="bo-platformInput" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="bo-platformInput" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="bo-platformInput" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="bo-platformCheckbox">
        <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} /> Superadmin
      </label>
      {error && <div className="bo-platformError">{error}</div>}
      <button className="bo-platformBtn" disabled={loading || !email || !name || !password} onClick={() => void submit()}>
        {loading ? "Creando..." : "Crear"}
      </button>
    </div>
  );
}

// ============ Subscriptions Tab ============

function SubscriptionsTab() {
  const [subs, setSubs] = useState<PlatformSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listSubscriptions();
      setSubs(res.subscriptions ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (id: number, currentActive: boolean) => {
    await platformAPI.toggleSubscription(id, !currentActive);
    void load();
  };

  return (
    <div data-ui="subscriptions-tab">
      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable">
            <thead>
              <tr>
                <th>ID</th><th>Restaurante</th><th>Feature</th><th>Concepto</th>
                <th>Importe</th><th>Frecuencia</th><th>Activa</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.restaurantName}</td>
                  <td><code>{s.featureKey || "-"}</code></td>
                  <td>{s.concept || "-"}</td>
                  <td>{s.amount.toFixed(2)} {s.currency}</td>
                  <td>{s.frequency}</td>
                  <td>{s.isActive ? "✅" : "❌"}</td>
                  <td>
                    <button className="bo-platformBtn" onClick={() => void handleToggle(s.id, s.isActive)} data-ui={`sub-toggle-${s.id}`}>
                      {s.isActive ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ WhatsApp Tab ============

function WhatsAppTab() {
  const [instances, setInstances] = useState<PlatformWhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listWhatsApp();
      setInstances(res.instances ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRenewQR = async (id: number) => {
    if (!confirm("Renovar QR para esta instancia? Se desconectara y generara uno nuevo.")) return;
    const res = await platformAPI.renewWhatsAppQR(id);
    alert(res.message ?? (res.success ? "QR renovado" : "Error"));
    void load();
  };

  const handleDisconnect = async (id: number) => {
    if (!confirm("Desconectar esta instancia de WhatsApp?")) return;
    const res = await platformAPI.disconnectWhatsApp(id);
    alert(res.message);
    void load();
  };

  return (
    <div data-ui="whatsapp-tab">
      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable" data-ui="whatsapp-table">
            <thead>
              <tr>
                <th>ID</th><th>Restaurante</th><th>Instancia</th><th>Telefono</th>
                <th>Estado</th><th>Pair Code</th><th>Activa</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id} data-ui={`wa-row-${i.id}`}>
                  <td>{i.id}</td>
                  <td>{i.restaurantName}</td>
                  <td><code>{i.instanceName}</code></td>
                  <td>{i.connectedPhone || "-"}</td>
                  <td><WhatsAppBadge status={i.status} /></td>
                  <td>{i.pairCode || "-"}</td>
                  <td>{i.isActive ? "✅" : "❌"}</td>
                  <td>
                    <div className="bo-platformActions">
                      <button className="bo-platformBtn" onClick={() => void handleRenewQR(i.id)} data-ui={`wa-renew-qr-${i.id}`}>
                        Renovar QR
                      </button>
                      <button className="bo-platformBtn bo-platformBtn--danger" onClick={() => void handleDisconnect(i.id)} data-ui={`wa-disconnect-${i.id}`}>
                        Desconectar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Stripe Tab ============

function StripeTab() {
  const [livePayments, setLivePayments] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundId, setRefundId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("requested_by_customer");
  const [refundResult, setRefundResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listStripePayments();
      setLivePayments((res.livePayments as Record<string, any>[]) ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRefund = async () => {
    setRefundResult("");
    const id = refundId.trim();
    if (!id) { setRefundResult("ID requerido"); return; }
    const amountCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : 0;
    const res = await platformAPI.refundStripe({ chargeId: id.startsWith("ch_") ? id : undefined, paymentIntentId: id.startsWith("pi_") ? id : undefined, amount: amountCents, reason: refundReason });
    setRefundResult(res.success ? "Devolucion procesada: " + JSON.stringify(res.refund) : "Error: " + (res.message ?? ""));
    if (res.success) { setRefundId(""); setRefundAmount(""); void load(); }
  };

  return (
    <div data-ui="stripe-tab">
      <div className="bo-platformCard" data-ui="stripe-refund-card">
        <h3 className="bo-platformCardTitle">Procesar Devolucion (Refund)</h3>
        <div className="bo-platformForm">
          <input className="bo-platformInput" placeholder="Charge ID (ch_...) o Payment Intent (pi_...)" value={refundId} onChange={(e) => setRefundId(e.target.value)} data-ui="stripe-refund-id" />
          <input className="bo-platformInput" type="number" step="0.01" placeholder="Cantidad EUR (vacio = total)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} data-ui="stripe-refund-amount" />
          <select className="bo-platformInput" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} data-ui="stripe-refund-reason">
            <option value="requested_by_customer">Solicitada por cliente</option>
            <option value="duplicate">Duplicado</option>
            <option value="fraudulent">Fraudulenta</option>
          </select>
          <button className="bo-platformBtn bo-platformBtn--danger" onClick={() => void handleRefund()} data-ui="stripe-refund-submit">
            Procesar Devolucion
          </button>
          {refundResult && <div className="bo-platformResult">{refundResult}</div>}
        </div>
      </div>

      <h3 className="bo-platformCardTitle">Pagos Recientes (Live API)</h3>
      {loading ? (
        <div className="bo-platformLoading">Cargando pagos...</div>
      ) : livePayments.length === 0 ? (
        <div className="bo-platformEmpty">No hay pagos o Stripe no esta configurado</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable" data-ui="stripe-payments-table">
            <thead>
              <tr>
                <th>Charge ID</th><th>Importe</th><th>Estado</th><th>Email</th>
                <th>Descripcion</th><th>Metadata</th><th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {livePayments.map((p, idx) => (
                <tr key={p.id ?? idx}>
                  <td><code>{String(p.id ?? "-")}</code></td>
                  <td>{((Number(p.amount) || 0) / 100).toFixed(2)} {String(p.currency ?? "").toUpperCase()}</td>
                  <td>{String(p.status ?? "-")} {p.refunded ? "(reembolsado)" : ""}</td>
                  <td>{String(p.receiptEmail ?? p.billingDetails?.email ?? "-")}</td>
                  <td>{String(p.description ?? "-")}</td>
                  <td>{p.metadata ? JSON.stringify(p.metadata) : "-"}</td>
                  <td>{p.created ? new Date(Number(p.created) * 1000).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Domains Tab ============

function DomainsTab() {
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listDomains();
      setDomains(res.domains ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div data-ui="domains-tab">
      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable">
            <thead>
              <tr>
                <th>ID</th><th>Restaurante</th><th>Dominio</th><th>Primario</th>
                <th>Registro</th><th>Pago Stripe</th><th>Coste</th><th>Auto-renovar</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.restaurantName}</td>
                  <td><code>{d.domain}</code></td>
                  <td>{d.isPrimary ? "✅" : ""}</td>
                  <td>{d.registrationStatus}</td>
                  <td>{d.stripePaymentStatus}</td>
                  <td>{d.registrationCost ? `${d.registrationCost.toFixed(2)} EUR` : "-"}</td>
                  <td>{d.autoRenew ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Servers Tab ============

function ServersTab() {
  const [servers, setServers] = useState<PlatformUAZAPIServer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.listUAZAPIServers();
      setServers(res.servers ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div data-ui="servers-tab">
      <p className="bo-platformSub">Servidores UAZAPI para instancias WhatsApp</p>
      {loading ? (
        <div className="bo-platformLoading">Cargando...</div>
      ) : (
        <div className="bo-platformTableWrap">
          <table className="bo-platformTable">
            <thead>
              <tr>
                <th>ID</th><th>Nombre</th><th>Provider</th><th>Base URL</th>
                <th>Capacidad</th><th>En uso</th><th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.provider}</td>
                  <td><code>{s.baseUrl}</code></td>
                  <td>{s.capacity}</td>
                  <td>{s.usedCount}</td>
                  <td>{s.isActive ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Shared components ============

function WhatsAppBadge({ status }: { status: string }) {
  if (!status || status === "disconnected") {
    return <span className="bo-waBadge bo-waBadge--off">Desconectado</span>;
  }
  if (status === "connected" || status === "open") {
    return <span className="bo-waBadge bo-waBadge--on">Conectado</span>;
  }
  return <span className="bo-waBadge bo-waBadge--pending">{status}</span>;
}
