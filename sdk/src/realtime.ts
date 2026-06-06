import type { RealtimeEvent, RealtimeCallback, RealtimePayload } from './types';

interface SubscriptionOptions {
  projectId: string;
  table: string;
  event?: RealtimeEvent;
  callback: RealtimeCallback;
  wsUrl: string;
  token: string | null;
  anonKey: string;
}

export class RealtimeSubscription {
  private ws: WebSocket | null = null;
  private closed = false;

  constructor(private opts: SubscriptionOptions) {
    this._connect();
  }

  private _connect(): void {
    if (this.closed) return;

    const token = this.opts.token ?? this.opts.anonKey;
    const url = `${this.opts.wsUrl}?token=${encodeURIComponent(token)}&project=${this.opts.projectId}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      // WebSocket not available (Node without ws polyfill)
      console.warn('[ZenDBX Realtime] WebSocket not available in this environment');
      return;
    }

    this.ws.onopen = () => {
      // Subscribe to the channel
      this.ws?.send(
        JSON.stringify({
          type: 'subscribe',
          payload: {
            channel: `${this.opts.projectId}:${this.opts.table}`,
            event: this.opts.event ?? '*',
          },
        })
      );
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload: RealtimePayload;
        };

        if (msg.type === 'broadcast') {
          const { event: msgEvent } = msg.payload;
          const wantedEvent = this.opts.event ?? '*';

          if (wantedEvent === '*' || wantedEvent === msgEvent) {
            this.opts.callback(msg.payload);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this.closed) {
        // Reconnect after 2 s
        setTimeout(() => this._connect(), 2000);
      }
    };
  }

  /** Unsubscribe and close the WebSocket */
  unsubscribe(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}

export class RealtimeModule {
  constructor(
    private projectId: string,
    private wsUrl: string,
    private getToken: () => string | null,
    private anonKey: string
  ) {}

  /**
   * Subscribe to changes on a table.
   *
   * @example
   * const sub = zendbx.realtime
   *   .from('messages')
   *   .on('INSERT', (payload) => console.log('New message:', payload.new))
   *   .subscribe()
   *
   * // Later:
   * sub.unsubscribe()
   */
  from(table: string): RealtimeChannelBuilder {
    return new RealtimeChannelBuilder(
      this.projectId,
      table,
      this.wsUrl,
      this.getToken,
      this.anonKey
    );
  }
}

class RealtimeChannelBuilder {
  private _event: RealtimeEvent = '*';
  private _callbacks: RealtimeCallback[] = [];

  constructor(
    private projectId: string,
    private table: string,
    private wsUrl: string,
    private getToken: () => string | null,
    private anonKey: string
  ) {}

  /** Filter by event type */
  on(event: RealtimeEvent, callback: RealtimeCallback): this {
    this._event = event;
    this._callbacks.push(callback);
    return this;
  }

  /** Open the WebSocket and start listening */
  subscribe(): RealtimeSubscription {
    const handlers = this._callbacks;

    return new RealtimeSubscription({
      projectId: this.projectId,
      table: this.table,
      event: this._event,
      callback: (payload) => handlers.forEach((cb) => cb(payload)),
      wsUrl: this.wsUrl,
      token: this.getToken(),
      anonKey: this.anonKey,
    });
  }
}
