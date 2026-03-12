import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService, ConfigResponse } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConfigService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch city from GET /api/v1/config', () => {
    const mockResponse: ConfigResponse = { city: 'Madrid' };

    service.getConfig().subscribe((config) => {
      expect(config.city).toBe('Madrid');
    });

    const req = httpTesting.expectOne('/api/v1/config');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should cache the config and not make a second HTTP call', () => {
    const mockResponse: ConfigResponse = { city: 'Madrid' };

    service.getConfig().subscribe((config) => {
      expect(config.city).toBe('Madrid');
    });

    const req = httpTesting.expectOne('/api/v1/config');
    req.flush(mockResponse);

    // Second call should use cached value
    service.getConfig().subscribe((config) => {
      expect(config.city).toBe('Madrid');
    });

    // No second HTTP request should be made
    httpTesting.expectNone('/api/v1/config');
  });
});
