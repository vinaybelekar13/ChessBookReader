import openingsTsv from "./openings.tsv?raw";

export interface Opening {
  eco: string;
  name: string;
  pgn: string;
  uci: string;
  epd: string;
}

const [headerLine, ...dataLines] = openingsTsv.trim().split(/\r?\n/);
const headers = headerLine.split("\t");

const openings: Opening[] = dataLines
  .filter(line => line.trim().length > 0)
  .map(line => {
    const values = line.split("\t");
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );
    return {
      eco: record.eco,
      name: record.name,
      pgn: record.pgn,
      uci: record.uci,
      epd: record.epd,
    };
  });

export default openings;