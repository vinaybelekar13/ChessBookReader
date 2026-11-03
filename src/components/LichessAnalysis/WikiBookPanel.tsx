import React, { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import type { ChessVariant, WikiBookArticle } from "./types";
import {
  searchOpenings,
  type EcoGroup,
  type OpeningRecord,
} from "./openingDatabase";

interface WikiBookPanelProps {
  variant: ChessVariant;
  onVariantChange: (v: ChessVariant) => void;
  wikiArticle: WikiBookArticle | null;
  wikiLoading: boolean;
  wikiError: string;
  identifiedOpening: OpeningRecord | null;
  hasPlayedMoves: boolean;
  onSelectOpening: (opening: OpeningRecord) => void;
}

const VARIANTS: ChessVariant[] = [
  "Standard",
  "Chess960",
  "King of the Hill",
  "Three-check",
  "Antichess",
  "Atomic",
  "Horde",
  "Racing Kings",
  "Crazyhouse",
];

const ECO_GROUPS: EcoGroup[] = ["ALL", "A", "B", "C", "D", "E"];

export const WikiBookPanel: React.FC<WikiBookPanelProps> = ({
  variant,
  onVariantChange,
  wikiArticle,
  wikiLoading,
  wikiError,
  identifiedOpening,
  hasPlayedMoves,
  onSelectOpening,
}) => {
  const [wikiOpen, setWikiOpen] = useState(true);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ecoGroup, setEcoGroup] = useState<EcoGroup>("ALL");

  useEffect(() => {
    // Keep the panel available before the first move.
    // After a move, show it only while the current position matches
    // an opening in the ECO database.
    setWikiOpen(!hasPlayedMoves || Boolean(identifiedOpening));
  }, [hasPlayedMoves, identifiedOpening]);

  const results = useMemo(
    () => searchOpenings(query, ecoGroup, 40),
    [query, ecoGroup]
  );

  return (
    <aside className="li-left-column" aria-label="Variant and WikiBook opening panel">
      <div className="li-variant-selector-wrap">
        <span className="li-variant-crown" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#9e9e9e">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
          </svg>
        </span>

        <select
          aria-label="Chess variant"
          className="li-variant-select"
          value={variant}
          onChange={(e) => onVariantChange(e.target.value as ChessVariant)}
        >
          {VARIANTS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <span className="li-variant-caret" aria-hidden="true">⌄</span>
      </div>

      <div className="li-wikibook-wrapper">
        <div className="li-wikibook-tab-row">
          <button
            type="button"
            className="li-wikibook-tab-btn"
            onClick={() => setWikiOpen((o) => !o)}
            aria-expanded={wikiOpen}
          >
            <span>WikiBook</span>
            {wikiOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {wikiOpen && (
          <div className="li-wikibook-card">
            <div className="li-wikibook-scroll">
              {identifiedOpening ? (
                <section className="li-opening-recognition">
                  <div className="li-opening-recognition-label">
                    OPENING DATABASE
                  </div>
                  <h2 className="li-wikibook-title">
                    {identifiedOpening.name}
                  </h2>
                  <div className="li-opening-eco">
                    ECO: {identifiedOpening.eco}
                  </div>
                  <p className="li-wikibook-paragraph">
                    Matched opening line: {identifiedOpening.pgn}
                  </p>
                </section>
              ) : (
                <section className="li-opening-recognition">
                  <div className="li-opening-recognition-label">
                    OPENING DATABASE
                  </div>
                  <h2 className="li-wikibook-title">
                    Opening not identified
                  </h2>
                  <p className="li-wikibook-paragraph">
                    No matching opening was found in the ECO database.
                  </p>
                </section>
              )}

              <section className="li-wikibook-article">
                <div className="li-opening-recognition-label">
                  WIKIBOOKS · CHESS OPENING THEORY
                </div>

                {wikiArticle ? (
                  <>
                    {wikiLoading && (
                      <p className="li-wikibook-update-status" role="status">
                        Updating theory for the selected position…
                      </p>
                    )}
                    <h3 className="li-wikibook-title">{wikiArticle.title}</h3>
                    {wikiArticle.extract
                      .split(/\n\s*\n/)
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p className="li-wikibook-paragraph" key={index}>
                          {paragraph}
                        </p>
                      ))}
                    <a
                      href={wikiArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="li-wikibook-source-link"
                    >
                      Read full article on Wikibooks ↗
                    </a>
                    <p className="li-wikibook-paragraph">
                      Source: Wikibooks, the free textbook project.
                    </p>
                    {wikiError && (
                      <p className="li-wikibook-paragraph" role="status">
                        Latest position could not be loaded: {wikiError}
                      </p>
                    )}
                  </>
                ) : wikiLoading ? (
                  <p className="li-wikibook-paragraph">
                    Finding the matching opening theory article…
                  </p>
                ) : wikiError ? (
                  <p className="li-wikibook-paragraph" role="status">
                    Could not load the Wikibooks article: {wikiError}
                  </p>
                ) : (
                  <p className="li-wikibook-paragraph">
                    Play a move to search for the matching opening theory article.
                  </p>
                )}
              </section>
              <div className="li-opening-catalogue">
                <button
                  type="button"
                  className="li-opening-catalogue-toggle"
                  onClick={() => setCatalogueOpen((open) => !open)}
                  aria-expanded={catalogueOpen}
                >
                  <span>Opening Database (3,865)</span>
                  {catalogueOpen ? (
                    <ChevronUp size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )}
                </button>

                {catalogueOpen && (
                  <div className="li-opening-catalogue-content">
                    <div className="li-opening-search">
                      <Search size={15} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, ECO or moves..."
                        aria-label="Search opening database"
                      />
                    </div>

                    <div className="li-opening-eco-filters" aria-label="Filter by ECO group">
                      {ECO_GROUPS.map((group) => (
                        <button
                          type="button"
                          key={group}
                          className={ecoGroup === group ? "active" : ""}
                          onClick={() => setEcoGroup(group)}
                        >
                          {group}
                        </button>
                      ))}
                    </div>

                    <div className="li-opening-results">
                      <div className="li-opening-result-count">
                        Showing {results.length} results (maximum 40)
                      </div>

                      {results.length === 0 ? (
                        <p className="li-wikibook-paragraph">
                          No matching openings found.
                        </p>
                      ) : (
                        results.map((opening) => (
                          <button
                            type="button"
                            className="li-opening-result"
                            key={`${opening.eco}-${opening.name}-${opening.pgn}`}
                            onClick={() => onSelectOpening(opening)}
                            title={`Load ${opening.name} on the board`}
                          >
                            <span className="li-opening-result-eco">
                              {opening.eco}
                            </span>
                            <span className="li-opening-result-name">
                              {opening.name}
                              <small>{opening.pgn}</small>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};





