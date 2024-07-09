export default class Banner {
  id: string;
  startTime: number;
  endTime: number;
  message: string;
  enabled: boolean;
  alertStyle: number;
  order: number;

  constructor(
    id: string,
    startTime: number,
    endTime: number,
    message: string,
    enabled: true,
    priority: 0,
    order: 0
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.message = message;
    this.enabled = enabled;
    this.alertStyle = priority;
    this.order = order;
  }

  setPriority(priority: number): void {
    this.alertStyle = priority;
  }

  setOrder(order: number): void {
    this.order = order;
  }
}
