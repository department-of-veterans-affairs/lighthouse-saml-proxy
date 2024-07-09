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
    alertStyle: 0,
    order: 0
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.message = message;
    this.enabled = enabled;
    this.alertStyle = alertStyle;
    this.order = order;
  }

  setAlertStyle(alertStyle: number): void {
    this.alertStyle = alertStyle;
  }

  setOrder(order: number): void {
    this.order = order;
  }
}
