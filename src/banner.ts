export default class Banner {
  id: string;
  startTime: string;
  endTime: string;
  message: string;
  enabled: boolean;
  priority: number;
  order: number;

  constructor(
    id: string,
    startTime: string,
    endTime: string,
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
    this.priority = priority;
    this.order = order;
  }

  setPriority(priority: number): void {
    this.priority = priority;
  }

  setOrder(order: number): void {
    this.order = order;
  }
}
