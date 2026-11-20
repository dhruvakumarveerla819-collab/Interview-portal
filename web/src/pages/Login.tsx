import { useState } from "react";
import { supabase, errorText } from "../lib/supabase";
import { Button, Input, Field } from "../components/ui";

/** Email one-time-code login (replaces sendPortalOtp / verifyPortalOtp). */
export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(notice ?? null);

  const send = async () => {
    setBusy(true); setMsg(null);
    // First login creates the auth user; the "before user created" hook (migration 5) rejects
    // emails that are not registered in app_users, and RLS denies everything to unregistered users.
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMsg(/not registered|signups not allowed|not found|403/i.test(error.message) ? "This email is not registered for the portal. Ask an admin to add you." : errorText(error));
    else { setStep("code"); setMsg("We emailed you a 6-digit code."); }
  };
  const verify = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMsg(errorText(error));
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Interview & Incentive Portal</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Sign in with your registered email.</p>
        {step === "email" ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <Field label="Email"><Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" /></Field>
            <Button variant="primary" className="w-full" busy={busy}>Send code</Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <Field label={`Code sent to ${email}`}><Input inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="w-full tracking-widest" /></Field>
            <Button variant="primary" className="w-full" busy={busy}>Verify & sign in</Button>
            <button type="button" className="w-full text-xs text-slate-500 hover:text-slate-700" onClick={() => setStep("email")}>Use a different email</button>
          </form>
        )}
        {msg && <p className="mt-4 text-sm text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}
