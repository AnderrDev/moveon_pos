export class LatestRequest {
  private current = 0
  begin(): number { return ++this.current }
  isCurrent(token: number): boolean { return token === this.current }
}
