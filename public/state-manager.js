function State(){
    this.score = {};
    this.cells = [];
    this.total = 0;

}
State.prototype.getCell = function(position){
    return this.cells[position.y][position.x];
}
  
State.prototype.updateCell = function(position, owner, players){
    this.getCell(position).owner = owner;
    this.getCell(position).players = players;
}