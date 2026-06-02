const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("es-MX") : "";

export const exportPdfReport = ({ title, subtitle = "", columns, rows, summary = [] }) => {
  if (!rows || rows.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  const printedAt = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const summaryHtml = summary.length
    ? `
      <section class="summary">
        ${summary.map((item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join("")}
      </section>
    `
    : "";

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111827;
            font-family: Arial, sans-serif;
            font-size: 11px;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          h1 {
            margin: 0;
            font-size: 22px;
            color: #0f172a;
          }
          .subtitle {
            margin-top: 5px;
            color: #475569;
            font-size: 12px;
          }
          .printed {
            color: #64748b;
            text-align: right;
            white-space: nowrap;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }
          .summary div {
            border: 1px solid #dbeafe;
            background: #eff6ff;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .summary span {
            display: block;
            color: #475569;
            font-size: 10px;
            margin-bottom: 3px;
          }
          .summary strong {
            color: #0f172a;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th {
            background: #1e3a8a;
            color: white;
            text-align: left;
            padding: 7px;
            font-size: 10px;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
            padding: 7px;
            vertical-align: top;
            overflow-wrap: anywhere;
          }
          tr:nth-child(even) td { background: #f8fafc; }
          footer {
            margin-top: 12px;
            color: #64748b;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
          </div>
          <div class="printed">Generado: ${escapeHtml(printedAt)}</div>
        </header>
        ${summaryHtml}
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
        <footer>Total de registros: ${rows.length}</footer>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 250);
          });
        </script>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const reportWindow = window.open(url, "_blank");

  if (!reportWindow) {
    URL.revokeObjectURL(url);
    alert("Permite ventanas emergentes para exportar el PDF");
    return;
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export { formatDate };
