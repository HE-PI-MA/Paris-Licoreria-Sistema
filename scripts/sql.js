const fs = require('fs');
// Files in this package use one statement terminator at the end of a line.
// Internal semicolons are retained between DELIMITER // and DELIMITER ;.
function splitSql(sql) {
  let delimiter = ';', pending = '';
  const statements = [];
  for (const line of sql.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('--')) continue;
    const directive = /^\s*DELIMITER\s+(\S+)\s*$/.exec(line);
    if (directive) {
      if (pending.trim()) throw new Error('SQL_DELIMITER_INCOMPLETE');
      delimiter = directive[1]; continue;
    }
    pending += line + '\n';
    if (line.trimEnd().endsWith(delimiter)) {
      statements.push(pending.trimEnd().slice(0, -delimiter.length).trim());
      pending = '';
    }
  }
  if (pending.trim()) throw new Error('SQL_STATEMENT_INCOMPLETE');
  return statements;
}
module.exports = { splitSql, readSql: file => splitSql(fs.readFileSync(file, 'utf8')) };
