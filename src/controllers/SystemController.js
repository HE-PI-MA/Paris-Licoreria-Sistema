const safeLog = require('../utils/safeLog');
class SystemController {
  constructor(systemService) {
    this.systemService = systemService;
    this.status = this.status.bind(this);
  }

  async status(req, res) {
    try {
      return res.status(200).json(await this.systemService.getStatus());
    } catch (error) {
      safeLog('SYSTEM_STATUS_FAILED', error, req.requestId);
      return res.status(503).json({
        application: "Paris Licoreria Sistema",
        status: "ERROR",
        database: "NO DISPONIBLE"
      });
    }
  }
}

module.exports = SystemController;
