import { useState } from "react";
import { supabase, q } from "../lib/supabase";
import { useSession } from "../lib/session";
import { todayWorkDate, monthRange, monthLabel, downloadCsv } from "../lib/format";
import { Button, Card, PageHeader, Input, Table, Td, Loading, ErrorBox, Empty, useAsync } from "../components/ui";
import type { CallStats } from "../lib/types";

/** Call performance per handler (PortalReports.gs / getPortalCallDashboardData) */
export function Reports() {
  const s = useSession();
  const [ym, setYm] = useState(todayWorkDate().slice(0, 7));
  const data = useAsync(async () =>
    (await q(supabase.from("handler_call_stats").select("*").eq("team_id", s.teamId!).eq("month", monthRange(ym)[0]))) as CallStats[],
  [s.teamId, ym]);

  const rows = (data.data ?? []).filter((r) => s.role !== "HANDLER" || (r.handler_id && s.myHandlerIds.includes(r.handler_id)))
    .sort((a, b) => b.total_calls - a.total_calls);
  const tot = rows.reduce((a, r) => ({ t: a.t + r.total_calls, c: a.c + r.completed, rs: a.rs + r.rescheduled, x: a.x + r.cancelled, o: a.o + r.open_calls, n: a.n + r.night_calls, s: a.s + r.selections }),
    { t: 0, c: 0, rs: 0, x: 0, o: 0, n: 0, s: 0 });
  const max = Math.max(1, ...rows.map((r) => r.total_calls));

  return (
    <>
      <PageHeader title="Reports" subtitle={`Calls by handler · ${monthLabel(ym)}`}
        actions={<>
          <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          <Button onClick={() => downloadCsv(`calls-${ym}.csv`, [["Handler", "Total", "Completed", "Rescheduled", "Cancelled", "Open", "Night", "Selections"],
            ...rows.map((r) => [r.handler_name ?? "Unassigned/Support", r.total_calls, r.completed, r.rescheduled, r.cancelled, r.open_calls, r.night_calls, r.selections])])}>Export CSV</Button>
        </>} />
      <Card pad={false}>
        {data.loading ? <Loading /> : data.error ? <div className="p-4"><ErrorBox error={data.error} /></div> : rows.length === 0 ? <Empty>No calls in {monthLabel(ym)}.</Empty> : (
          <Table head={["Handler", "Calls", "", "Completed", "Rescheduled", "Cancelled", "Open", "Night", "Selections", "Completion"]}>
            {rows.map((r) => (
              <tr key={r.handler_id ?? "none"}>
                <Td className="font-medium">{r.handler_name ?? <span className="text-slate-500">Unassigned / Support</span>}</Td>
                <Td className="tabular">{r.total_calls}</Td>
                <Td className="w-40"><div className="flex h-2 overflow-hidden rounded bg-slate-100" style={{ width: `${(r.total_calls / max) * 100}%` }}>
                  <div className="bg-emerald-500" style={{ width: `${(r.completed / r.total_calls) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(r.rescheduled / r.total_calls) * 100}%` }} />
                  <div className="bg-rose-400" style={{ width: `${(r.cancelled / r.total_calls) * 100}%` }} />
                </div></Td>
                <Td className="tabular">{r.completed}</Td><Td className="tabular">{r.rescheduled}</Td><Td className="tabular">{r.cancelled}</Td>
                <Td className="tabular">{r.open_calls}</Td><Td className="tabular">{r.night_calls}</Td><Td className="tabular">{r.selections}</Td>
                <Td className="tabular">{r.total_calls ? Math.round((r.completed / r.total_calls) * 100) : 0}%</Td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <Td>Total</Td><Td className="tabular">{tot.t}</Td><Td /><Td className="tabular">{tot.c}</Td><Td className="tabular">{tot.rs}</Td><Td className="tabular">{tot.x}</Td>
              <Td className="tabular">{tot.o}</Td><Td className="tabular">{tot.n}</Td><Td className="tabular">{tot.s}</Td><Td className="tabular">{tot.t ? Math.round((tot.c / tot.t) * 100) : 0}%</Td>
            </tr>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-slate-500"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />completed <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />rescheduled <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-rose-400" />cancelled</p>
    </>
  );
}
