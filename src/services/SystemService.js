class SystemService {
  constructor(systemRepository) {
    this.systemRepository = systemRepository;
  }

  async getStatus() {
    await this.systemRepository.checkDatabaseConnection();
    return {
      application: "Paris Licoreria Sistema",
      status: "OK",
      database: "OK"
    };
  }
}

module.exports = SystemService;
