/**
 * WebSocket server for real-time payment status updates
 * This replaces the polling mechanism in PaymentStatusCard
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verify } from 'jsonwebtoken';
import { Payment } from '@prisma/client';

export interface PaymentWebSocketMessage {
  type: 'payment_status_update' | 'payment_retry_update' | 'error' | 'heartbeat' | 'authentication_success' | 'subscription_success' | 'unsubscription_success';
  paymentId?: string;
  userId?: string;
  status?: string;
  data?: any;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  paymentId?: string;
  isAlive?: boolean;
}

export class PaymentWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port?: number) {
    this.wss = new WebSocketServer({ 
      port: port || 8080,
      path: '/ws/payment-status'
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection established');
      
      ws.isAlive = true;
      
      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendMessage(ws, {
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: new Date().toISOString()
          });
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any) {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message);
        break;
      
      case 'subscribe_payment':
        await this.handlePaymentSubscription(ws, message);
        break;
      
      case 'unsubscribe_payment':
        this.handlePaymentUnsubscription(ws, message);
        break;
      
      case 'ping':
        this.sendMessage(ws, {
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        this.sendMessage(ws, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` },
          timestamp: new Date().toISOString()
        });
    }
  }

  private async handleAuthentication(ws: AuthenticatedWebSocket, message: any) {
    try {
      const { token } = message;
      
      if (!token) {
        throw new Error('Authentication token required');
      }

      // Verify JWT token
      const payload = verify(token, process.env.JWT_SECRET!) as { id: string };
      ws.userId = payload.id;

      this.sendMessage(ws, {
        type: 'authentication_success',
        userId: ws.userId,
        timestamp: new Date().toISOString()
      });

      console.log(`WebSocket authenticated for user: ${ws.userId}`);
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Authentication failed' },
        timestamp: new Date().toISOString()
      });
      ws.close();
    }
  }

  private async handlePaymentSubscription(ws: AuthenticatedWebSocket, message: any) {
    if (!ws.userId) {
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Authentication required' },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { paymentId } = message;
    
    if (!paymentId) {
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Payment ID required' },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // TODO: Verify user has access to this payment
    // const payment = await prisma.payment.findFirst({
    //   where: { id: paymentId, userId: ws.userId }
    // });
    // 
    // if (!payment) {
    //   this.sendMessage(ws, {
    //     type: 'error',
    //     data: { message: 'Payment not found or access denied' },
    //     timestamp: new Date().toISOString()
    //   });
    //   return;
    // }

    ws.paymentId = paymentId;
    
    // Add to clients map
    if (!this.clients.has(paymentId)) {
      this.clients.set(paymentId, new Set());
    }
    this.clients.get(paymentId)!.add(ws);

    this.sendMessage(ws, {
      type: 'subscription_success',
      paymentId,
      timestamp: new Date().toISOString()
    });

    console.log(`WebSocket subscribed to payment: ${paymentId} for user: ${ws.userId}`);
  }

  private handlePaymentUnsubscription(ws: AuthenticatedWebSocket, message: any) {
    const { paymentId } = message;
    
    if (paymentId && this.clients.has(paymentId)) {
      this.clients.get(paymentId)!.delete(ws);
      
      // Clean up empty sets
      if (this.clients.get(paymentId)!.size === 0) {
        this.clients.delete(paymentId);
      }
    }

    ws.paymentId = undefined;
    
    this.sendMessage(ws, {
      type: 'unsubscription_success',
      paymentId,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(ws: AuthenticatedWebSocket) {
    // Remove from all payment subscriptions
    if (ws.paymentId && this.clients.has(ws.paymentId)) {
      this.clients.get(ws.paymentId)!.delete(ws);
      
      if (this.clients.get(ws.paymentId)!.size === 0) {
        this.clients.delete(ws.paymentId);
      }
    }

    console.log(`WebSocket disconnected for user: ${ws.userId}`);
  }

  private sendMessage(ws: WebSocket, message: PaymentWebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Broadcast payment status update to all subscribed clients
   */
  public broadcastPaymentUpdate(paymentId: string, payment: Payment) {
    const clients = this.clients.get(paymentId);
    
    if (!clients || clients.size === 0) {
      return; // No clients subscribed to this payment
    }

    const message: PaymentWebSocketMessage = {
      type: 'payment_status_update',
      paymentId,
      status: payment.status,
      data: {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
        paidAmount: payment.paidAmount.toString(),
        paidAmountCurrency: payment.paidAmountCurrency,
        provider: payment.provider,
        providerPaymentMethod: payment.providerPaymentMethod,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt?.toISOString(),
      },
      timestamp: new Date().toISOString()
    };

    clients.forEach(ws => {
      this.sendMessage(ws, message);
    });

    console.log(`Broadcasted payment update to ${clients.size} clients for payment: ${paymentId}`);
  }

  /**
   * Broadcast payment retry update
   */
  public broadcastPaymentRetryUpdate(paymentId: string, retryInfo: any) {
    const clients = this.clients.get(paymentId);
    
    if (!clients || clients.size === 0) {
      return;
    }

    const message: PaymentWebSocketMessage = {
      type: 'payment_retry_update',
      paymentId,
      data: retryInfo,
      timestamp: new Date().toISOString()
    };

    clients.forEach(ws => {
      this.sendMessage(ws, message);
    });

    console.log(`Broadcasted payment retry update to ${clients.size} clients for payment: ${paymentId}`);
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      totalConnections: this.wss.clients.size,
      activePaymentSubscriptions: this.clients.size,
      subscriptionDetails: Array.from(this.clients.entries()).map(([paymentId, clients]) => ({
        paymentId,
        subscriberCount: clients.size
      }))
    };
  }

  /**
   * Close the WebSocket server
   */
  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

// Global WebSocket server instance
let wsServer: PaymentWebSocketServer | null = null;

export function getPaymentWebSocketServer(): PaymentWebSocketServer {
  if (!wsServer) {
    wsServer = new PaymentWebSocketServer();
  }
  return wsServer;
}

export function broadcastPaymentUpdate(paymentId: string, payment: Payment) {
  const server = getPaymentWebSocketServer();
  server.broadcastPaymentUpdate(paymentId, payment);
}

export function broadcastPaymentRetryUpdate(paymentId: string, retryInfo: any) {
  const server = getPaymentWebSocketServer();
  server.broadcastPaymentRetryUpdate(paymentId, retryInfo);
}