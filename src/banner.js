class Banner {
  constructor(id, startTime, endTime, message) {
    this.id = id; //unique identifier for the banner
    this.startTime = startTime;
    this.endTime = endTime;
    this.enabled = false;
    this.message = message;
    this.priority = 0;
    this.order = 0;
  }

  setPriority(priority) {
    this.priority = priority;
  }

  setOrder(order) {
    this.order = order;
  }
}

module.exports = Banner;
