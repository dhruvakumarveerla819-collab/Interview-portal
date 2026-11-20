import { useState } from "react";
import { supabase, q, rpc } from "../lib/supabase";
import { useSession } from "../lib/session";
import { inr, shortDate, monthRange, todayWorkDate, downloadCsv, monthLabel } from "../lib/format";
import { Button, Card, PageHeader, Input, Table, Td, Badge, Loading, ErrorBox, Empty, Select, Stat, useAsync, useAction } from "../components/ui";
import type { Incentive, IncentiveStatus } from "../lib/types";

export function Incentives() {
  const s = useSession();
  const [ym, setYm] = useState(todayWorkDate().slice(0, 7));
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [handler, setHandler] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { busy, run } = useAction();
  const admin = s.isTeamAdmin;

  const data = useAsync(async () => {
    const [from, to] = monthRange(ym);
    let b = supabase.from("incentives").select("*").eq("team_id", s.teamId!).gte("event_date", from).lt("event_date", to)
      .order("event_date").order("handler_name");
    if (type) b = b.eq("type", type);
    if (status) b = b.eq("status", status);
    if (handler) b = b.eq("handler_id", handler);
    if (s.role === "HANDLER") b = b.in("handler_id", s.myHandlerIds.length ? s.myHandlerIds : ["-"]);
    return (await q(b)) as Incentive[];
  }, [s.teamId, ym, type, status, handler, s.role]);

  const rows = data.data ?? [];
  const live = rows.filter((r) => r.status !== "rejected");
  const total = live.reduce((a, r) => a + Number(r.amount), 0);
  const setStatusFor = (st: IncentiveStatus) => run("st" + st, async () => {
    await rpc("set_incentive_status", { p_ids: [...sel], p_status: st });
    setSel(new Set()); data.reload();
  }, `${sel.size} marked ${st}`);

  const toggleAll = () => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  return (
    <>
      <PageHeader title="Incentive Tracker" subtitle={admin ? "Promotion and selection incentives for the team." : "Your promotion and selection incentives."}
        actions={<>
          <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="promotion">Promotion</option><option value="selection">Selection</option></Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending", "approved", "paid", "rejected"].map((x) => <option key={x} value={x}>{x}</option>)}</Select>
          {admin && <Select value={handler} onChange={(e) => setHandler(e.target.value)}><option value="">All handlers</option>{s.handlers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>}
          <Button onClick={() => downloadCsv(`incentives-${ym}.csv`, [["Type", "Candidate", "Client", "From", "To", "Previous Date", "Date", "Handler", "Amount", "Status"],
            ...rows.map((r) => [r.type, r.candidate_name, r.client_name, r.from_round, r.to_round, r.previous_date, r.event_date, r.handler_name, r.amount, r.status])])}>Export CSV</Button>
          {admin && <Button variant="primary" busy={busy === "scan"} onClick={() => run("scan", async () => {
            const r = await rpc<{ promotions_added: number; selections_added: number }>("recompute_incentives", { p_team: s.teamId });
            data.reload();
            return r;
          }, "Scan complete")}>Scan for new</Button>}
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Total · ${monthLabel(ym)}`} value={inr(total)} tone="indigo" />
        <Stat label="Promotions" value={live.filter((r) => r.type === "promotion").length} sub={inr(live.filter((r) => r.type === "promotion").reduce((a, r) => a + Number(r.amount), 0))} />
        <Stat label="Selections" value={live.filter((r) => r.type === "selection").length} sub={inr(live.filter((r) => r.type === "selection").reduce((a, r) => a + Number(r.amount), 0))} />
        <Stat label="Pending review" value={rows.filter((r) => r.status === "pending").length} tone="amber" />
      </div>

      {admin && sel.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm ring-1 ring-indigo-200">
          <b>{sel.size}</b> selected
          <span className="flex-1" />
          <Button size="sm" variant="success" busy={busy === "stapproved"} onClick={() => setStatusFor("approved")}>Approve</Button>
          <Button size="sm" variant="primary" busy={busy === "stpaid"} onClick={() => setStatusFor("paid")}>Mark paid</Button>
          <Button size="sm" variant="danger" busy={busy === "strejected"} onClick={() => setStatusFor("rejected")}>Reject</Button>
          <Button size="sm" variant="ghost" busy={busy === "stpending"} onClick={() => setStatusFor("pending")}>Reset to pending</Button>
        </div>
      )}

      <Card pad={false}>
        {data.loading ? <Loading /> : data.error ? <div className="p-4"><ErrorBox error={data.error} /></div> : rows.length === 0 ? <Empty>No incentives for {monthLabel(ym)}.</Empty> : (
          <Table head={[admin ? <input type="checkbox" checked={sel.size === rows.length} onChange={toggleAll} /> : "", "Type", "Candidate", "Client", "Progression", "Earned on", "Proven on", "Handler", "Amount", "Status"]}>
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "rejected" ? "opacity-50" : ""}>
                <Td>{admin && <input type="checkbox" checked={sel.has(r.id)} onChange={() => { const n = new Set(sel); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSel(n); }} />}</Td>
                <Td><Badge v={r.type} /></Td>
                <Td>{r.candidate_name}</Td>
                <Td>{r.client_name}</Td>
                <Td className="whitespace-nowrap text-xs">{r.type === "promotion" ? `${r.from_round} → ${r.to_round}` : "Selected"}</Td>
                <Td className="whitespace-nowrap">{shortDate(r.previous_date)}</Td>
                <Td className="whitespace-nowrap">{shortDate(r.event_date)}</Td>
                <Td>{r.handler_name}</Td>
                <Td className="tabular font-medium">{inr(r.amount)}</Td>
                <Td><Badge v={r.status} />{r.source === "import" && <span className="ml-1 text-[10px] text-slate-400">legacy</span>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
