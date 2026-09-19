class DashboardService{constructor(repository){this.repository=repository;}summary(actor){return this.repository.summary(actor);}}module.exports=DashboardService;
