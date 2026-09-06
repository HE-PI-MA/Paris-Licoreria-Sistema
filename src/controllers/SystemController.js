class SystemController {
  constructor(systemService) {
    this.systemService = systemService;
    this.status = this.status.bind(this);
  }

  async status(req, res) {
    try {
      return res.status(200).json(await this.systemService.getStatus());
    } catch (error) {
      console.error("Error verificando el sistema:", error.message);
      return res.status(503).json({
        application: "Paris Licoreria Sistema",
        status: "ERROR",
        database: "NO DISPONIBLE"
      });
    }
  }
}

module.exports = SystemController;
