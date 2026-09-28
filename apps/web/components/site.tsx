import { API_DOCS, BOT, COLOSSEUM, GITHUB, RUBRICS } from "../lib/links.js";
import { Mark, WordmarkLetters } from "./brand.js";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <a href="/" className="brand" aria-label="Hyphae, home">
          <Mark size={36} />
          <WordmarkLetters height={15} />
        </a>
        <nav className="site-nav" aria-label="Site">
          <a className="wide" href="/#how">
            How it works
          </a>
          <a className="wide" href="/#proof">
            Proof
          </a>
          <a href="/community">Community</a>
          <a href="/claim">Claim</a>
          <a className="roomy" href={GITHUB} rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <a href="/" className="brand" aria-label="Hyphae, home">
          <Mark size={28} small />
          <WordmarkLetters height={12} />
        </a>
        <ul>
          <li>
            <a href={GITHUB} rel="noopener noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a href={API_DOCS} rel="noopener noreferrer">
              API docs
            </a>
          </li>
          <li>
            <a href={RUBRICS} rel="noopener noreferrer">
              Rubrics
            </a>
          </li>
          <li>
            <a href={BOT} rel="noopener noreferrer">
              The bot
            </a>
          </li>
          <li>
            <a href={COLOSSEUM} rel="noopener noreferrer">
              Colosseum
            </a>
          </li>
        </ul>
        <p className="fine">
          Points are not money. An allocation or payment appears only once the chain confirms it.
          All times UTC. MIT licensed, built for Colosseum's Crypto World's Fair.
        </p>
      </div>
    </footer>
  );
}
