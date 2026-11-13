import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TOPICS = [
  { k: 'bug', label: 'Bug or problem with the site' },
  { k: 'data', label: 'Data correction (an item is wrong)' },
  { k: 'suggestion', label: 'Suggestion or idea' },
  { k: 'other', label: 'Other (including takedown requests)' },
] as const;
const MAX = 4000;
const THROTTLE_KEY = 'pikkis-contact-sent';
// Optional email notification. Web3Forms access keys are public by design (they only allow sending to the
// address registered with the key), so it is safe in the client. Unset = messages are only stored.
const WEB3FORMS_KEY: string | undefined = import.meta.env.VITE_WEB3FORMS_KEY;

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-5 sm:p-6 shadow-sm';
const input = 'w-full px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 text-sm';
const label = 'block text-sm text-zinc-600 dark:text-zinc-300 mb-1';

function recentSends(): number[] {
  try { return (JSON.parse(localStorage.getItem(THROTTLE_KEY) || '[]') as number[]).filter(t => Date.now() - t < 3600_000); } catch { return []; }
}

export default function ContactPage() {
  const [params] = useSearchParams();
  const initialTopic = TOPICS.some(t => t.k === params.get('topic')) ? params.get('topic')! : 'bug';
  const [topic, setTopic] = useState<string>(initialTopic);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(params.get('item') ? `About item: ${params.get('item')}\n\n` : '');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (website) { setStatus({ ok: true, text: 'Thanks! Your message was sent.' }); return; } // bots: pretend success
    const text = message.trim();
    if (!text) { setStatus({ ok: false, text: 'Please write a message.' }); return; }
    const sends = recentSends();
    if (sends.length && Date.now() - sends[sends.length - 1] < 30_000) { setStatus({ ok: false, text: 'Please wait a few seconds before sending another message.' }); return; }
    if (sends.length >= 5) { setStatus({ ok: false, text: 'You have sent several messages recently. Please try again in an hour.' }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('contact_messages').insert({
        topic, name: name.trim() || null, reply_email: email.trim() || null, message: text.slice(0, MAX),
        page_url: document.referrer ? document.referrer.slice(0, 500) : null,
      });
      if (error) throw error;
      try { localStorage.setItem(THROTTLE_KEY, JSON.stringify([...sends, Date.now()])); } catch { /* ignore */ }
      if (WEB3FORMS_KEY) {
        fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY, subject: `Pikki's Info: ${TOPICS.find(t => t.k === topic)?.label || topic}`,
            from_name: "Pikki's Info contact form", name: name.trim() || 'Anonymous', email: email.trim() || undefined,
            topic, message: text.slice(0, MAX),
          }),
        }).catch(err => console.warn('Notification failed (message is still saved)', err));
      }
      setMessage(''); setStatus({ ok: true, text: 'Thanks! Your message was sent.' + (email.trim() ? ' We may reply by email.' : '') });
    } catch (err) {
      const m = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
      setStatus({ ok: false, text: /too many/i.test(m) ? 'Too many messages from your connection. Please try again later.' : 'Sorry, the message could not be sent. Please try again.' });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-50">Contact</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">Found a bug, a wrong number, or have an idea? Tell us. Corrections are reviewed by hand. You don't need an account, and your name and email are optional.</p>
      </div>
      <form onSubmit={submit} className={`${card} space-y-4`} noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2"><span className={label}>Topic</span>
            <select className={`${input} h-11`} value={topic} onChange={e => setTopic(e.target.value)}>
              {TOPICS.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Name <span className="text-zinc-500">(optional)</span></span>
            <input className={`${input} h-11`} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="nickname" />
          </label>
          <label className="block"><span className={label}>Reply email <span className="text-zinc-500">(optional)</span></span>
            <input className={`${input} h-11`} type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} autoComplete="email" inputMode="email" />
          </label>
          <label className="block sm:col-span-2"><span className={label}>Message</span>
            <textarea className={`${input} py-3 h-48 resize-none`} value={message} onChange={e => setMessage(e.target.value.slice(0, MAX))} maxLength={MAX} required
              placeholder="For data corrections, include the item name, category and No. if you can." />
            <span className="block text-right text-[11px] text-zinc-500 tabular-nums">{message.length.toLocaleString()} / {MAX.toLocaleString()}</span>
          </label>
          {/* Honeypot: hidden from people, tempting for bots. */}
          <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
            <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} name="website" /></label>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button type="submit" disabled={busy} className="h-11 w-40 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            <Send className="w-4 h-4" aria-hidden /> {busy ? 'Sending…' : 'Send message'}
          </button>
          <p className={`text-sm min-h-5 flex-1 min-w-[200px] inline-flex items-center gap-1.5 ${status?.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`} role="status" aria-live="polite">
            {status && (status.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> : <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />)}
            {status?.text}
          </p>
        </div>
      </form>
      <p className="text-xs text-zinc-500">Messages are stored privately and only read by the site maintainers. See the <Link to="/about" className="underline hover:text-amber-700 dark:hover:text-amber-300">About page</Link> for credits and the fan-site disclaimer.</p>
    </div>
  );
}
