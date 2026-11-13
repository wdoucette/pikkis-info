import { Link } from 'react-router-dom';

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-5 sm:p-6 shadow-sm';
const h2 = 'font-display text-xl sm:text-2xl mb-2 text-zinc-900 dark:text-zinc-50';
const p = 'text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-300';
const a = 'text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:no-underline';

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <h1 className="font-display text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-50">About Pikki's Info</h1>

      <section className={card}>
        <h2 className={h2}>What this is</h2>
        <p className={p}>
          Pikki's Info is a free, fan-made decompose and wardrobe guide for <i>Love Nikki: Dress Up Queen</i>. It follows in the
          footsteps of the community guides players relied on for years: look up any item, see what it's used to craft or evolve into,
          and know how many copies you need before you decompose or sell anything.
        </p>
        <ul className={`${p} list-disc pl-5 mt-3 space-y-1`}>
          <li>Item data is refreshed weekly from public sources.</li>
          <li>Community corrections and editorial notes are reviewed by hand by Paige. Send yours on the <Link to="/contact?topic=data" className={a}>contact page</Link>.</li>
          <li>Track what you own and want in <Link to="/my-wardrobe" className={a}>My Wardrobe</Link>. It's saved in your browser, or in the cloud if you sign in.</li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Credits</h2>
        <ul className={`${p} list-disc pl-5 space-y-1`}>
          <li>Item and recipe data: <a className={a} href="https://nikkicalc.com" target="_blank" rel="noreferrer">Nikki Calc</a> and the wider Love Nikki community.</li>
          <li>Corrections and editorial notes: Paige and the players who send them in.</li>
          <li>Fonts: Fredoka and Nunito (SIL Open Font License). Accounts and storage by Supabase; hosting by Vercel.</li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Fan-site disclaimer</h2>
        <p className={p}>
          <i>Love Nikki</i> and its characters, items, names and art belong to their respective owners (Elex and Papergames).
          Pikki's Info is an unofficial, non-commercial fan project. It is not affiliated with, endorsed by or sponsored by them.
          Item names and game data belong to their owners and are used here for reference only.
        </p>
        <p className={`${p} mt-3`}>
          Rights holders can request a correction or takedown on the <Link to="/contact?topic=other" className={a}>contact page</Link>, and we'll act on it promptly.
        </p>
      </section>

      <section className={card}>
        <h2 className={h2}>Licensing</h2>
        <ul className={`${p} list-disc pl-5 space-y-1`}>
          <li>Site source code: <a className={a} href="https://github.com/wdoucette/pikkis-info/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>.</li>
          <li>Original site text and the Pikki's Info “P” artwork: <a className={a} href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a> (see <a className={a} href="https://github.com/wdoucette/pikkis-info/blob/main/LICENSE-CONTENT.md" target="_blank" rel="noreferrer">LICENSE-CONTENT</a>).</li>
          <li>Game names, items and data are not covered by these licenses. They remain the property of their owners.</li>
        </ul>
      </section>
    </div>
  );
}
