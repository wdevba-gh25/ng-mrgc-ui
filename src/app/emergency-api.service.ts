import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CollapseResponse, DispatchRequest, DispatchResult, HealthResponse } from './models';

@Injectable({ providedIn: 'root' })
export class EmergencyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://20.81.83.150:4001';

  healthCheck(): Promise<HealthResponse> {
    return firstValueFrom(this.http.get<HealthResponse>(`${this.baseUrl}/health`));
  }

  scheduleCollapse(seconds: number, cause: string): Promise<CollapseResponse> {
    return firstValueFrom(
      this.http.post<CollapseResponse>(`${this.baseUrl}/simulate/collapse`, { delaySec: seconds, cause })
    );
  }

  cancelCollapse(): Promise<{ scheduled: boolean; message: string }> {
    return firstValueFrom(this.http.delete<{ scheduled: boolean; message: string }>(`${this.baseUrl}/simulate/collapse`));
  }

  async simulateOne(payload: DispatchRequest): Promise<DispatchResult> {
    try {
      return await firstValueFrom(this.http.post<DispatchResult>(`${this.baseUrl}/simulate/dispatch`, payload));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
        return error.error as DispatchResult;
      }
      throw error;
    }
  }
}
