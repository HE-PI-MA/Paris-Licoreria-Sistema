class SystemService {
  constructor(systemRepository) {
    this.systemRepository = systemRepository;
  }

  async getStatus() {
    const database = await this.systemRepository.getDatabaseStatus();

    return {
      application: 'Paris Licoreria Sistema',
      status: 'OK',
      database
    };
  }
}

module.exports = SystemService;
