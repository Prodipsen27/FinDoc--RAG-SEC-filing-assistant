import {
  closePool,
  companyNameForTicker,
  documentIdForAccession,
  getManifest,
  getPoolClient,
} from './_shared.js';

async function main() {
  const manifest = getManifest();
  const filings = Array.isArray(manifest.filings) ? manifest.filings : [];
  const pool = getPoolClient();

  for (const filing of filings) {
    const documentId = documentIdForAccession(filing.accession_number);
    const fiscalYear = String(filing.report_date || filing.filing_date).slice(0, 4);

    await pool.query(
      `INSERT INTO source_documents (
         id, ticker, company_name, form, filing_date, fiscal_year, accession_number, source_url
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         ticker = EXCLUDED.ticker,
         company_name = EXCLUDED.company_name,
         form = EXCLUDED.form,
         filing_date = EXCLUDED.filing_date,
         fiscal_year = EXCLUDED.fiscal_year,
         accession_number = EXCLUDED.accession_number,
         source_url = EXCLUDED.source_url`,
      [
        documentId,
        filing.ticker,
        companyNameForTicker(filing.ticker),
        filing.form,
        filing.filing_date,
        fiscalYear,
        filing.accession_number,
        filing.source_url,
      ],
    );
  }

  console.log(`Loaded ${filings.length} source document records.`);
}

main()
  .catch((error) => {
    console.error('Source document load failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
