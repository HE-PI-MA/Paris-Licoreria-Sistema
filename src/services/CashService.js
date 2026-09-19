const Input = require('../domain/OperationInput');
const { RecordError } = require('../domain/RecordInput');
class CashService {
  constructor(repository){this.repository=repository;}
  boxes(){return this.repository.boxes();}
  denominations(){return this.repository.denominations();}
  current(actor){return this.repository.current(actor.idUsuario);}
  status(actor){return Promise.all([this.repository.current(),this.repository.current(actor.idUsuario),this.repository.boxes()]).then(([open,mine,boxes])=>({open,mine,boxes}));}
  async open(actor,body){
    const data=Input.cashOpen(body);
    try{const id=await this.repository.open(Input.id(actor.idUsuario),data);return {id,...await this.repository.current(actor.idUsuario)};}
    catch(error){if(error.business&&error.message==='CAJA_YA_ABIERTA')throw new RecordError(409,'Ya existe un turno de caja abierto. Ciérralo antes de abrir otro.');if(error.business&&error.message==='CAJA_INACTIVA')throw new RecordError(409,'La caja seleccionada no está activa.');if(error.business)throw new RecordError(403,'Tu usuario ya no está activo.');throw error;}
  }
  async close(actor,body){
    const current=await this.repository.current(actor.idUsuario);if(!current)throw new RecordError(409,'No tienes un turno de caja abierto para cerrar.');
    const data=Input.cashClose(body);
    try{return await this.repository.close(current.id,actor.idUsuario,data);}catch(error){if(error.code==='ER_SIGNAL_EXCEPTION')throw new RecordError(409,error.sqlMessage||'No se pudo cerrar la caja.');throw error;}
  }
  history(actor,query){const input=Input.page(query,['date','cash','user','state']);if(!query.sort)input.sort='date';if(!query.direction)input.direction='desc';return this.repository.history(input,actor);}
}
module.exports=CashService;
