// Deliberately never serialize the received Error, request, body or headers.
function safeLog(event, error, requestId) {
  const allowed = ['ER_ACCESS_DENIED_ERROR', 'ER_NO_SUCH_TABLE', 'ECONNREFUSED', 'ETIMEDOUT', 'EADDRINUSE'];
  console.error(JSON.stringify({ event, requestId,
    category: allowed.includes(error?.code) ? error.code : 'APPLICATION_ERROR' }));
}
module.exports = safeLog;
