class SystemController {
  constructor(systemService) {
    this.systemService = systemService;
    this.status = this.status.bind(this);
  }

  async status(req, res) {
    try {
      const result = await this.systemService.getStatus();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error verificando el sistema:', error.message);

      return res.status(500).json({
        application: 'Paris Licoreria Sistema',
        status: 'ERROR',
        database: 'NO DISPONIBLE'
      });
    }
  }
}

module.exports = SystemController;
