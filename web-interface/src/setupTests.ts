// src/setupTests.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Set up testing-library
configure({ 
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000 
});

// Mock the canvas API for tests
// This is necessary for components that use canvas rendering
class MockContext2D implements CanvasRenderingContext2D {
  // Basic mock implementation with empty methods
  // Add methods as needed for specific tests
  canvas: HTMLCanvasElement = document.createElement('canvas');
  direction: CanvasDirection = 'ltr';
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  filter: string = 'none';
  font: string = '10px sans-serif';
  globalAlpha: number = 1;
  globalCompositeOperation: string = 'source-over';
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: ImageSmoothingQuality = 'low';
  lineCap: CanvasLineCap = 'butt';
  lineDashOffset: number = 0;
  lineJoin: CanvasLineJoin = 'miter';
  lineWidth: number = 1;
  miterLimit: number = 10;
  shadowBlur: number = 0;
  shadowColor: string = 'rgba(0, 0, 0, 0)';
  shadowOffsetX: number = 0;
  shadowOffsetY: number = 0;
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  
  // Implementation of required methods
  arc() {}
  arcTo() {}
  beginPath() {}
  bezierCurveTo() {}
  clearRect() {}
  clip() {}
  closePath() {}
  createConicGradient(): CanvasGradient { return {} as CanvasGradient; }
  createImageData(): ImageData { return {} as ImageData; }
  createLinearGradient(): CanvasGradient { return {} as CanvasGradient; }
  createPattern(): CanvasPattern | null { return null; }
  createRadialGradient(): CanvasGradient { return {} as CanvasGradient; }
  drawFocusIfNeeded() {}
  drawImage() {}
  ellipse() {}
  fill() {}
  fillRect() {}
  fillText() {}
  getContextAttributes(): any { return {}; }
  getImageData(): ImageData { return {} as ImageData; }
  getLineDash(): number[] { return []; }
  getTransform(): DOMMatrix { return {} as DOMMatrix; }
  isPointInPath(): boolean { return false; }
  isPointInStroke(): boolean { return false; }
  lineTo() {}
  measureText(): TextMetrics { return {} as TextMetrics; }
  moveTo() {}
  putImageData() {}
  quadraticCurveTo() {}
  rect() {}
  resetTransform() {}
  restore() {}
  rotate() {}
  save() {}
  scale() {}
  setLineDash() {}
  setTransform() {}
  stroke() {}
  strokeRect() {}
  strokeText() {}
  transform() {}
  translate() {}
}

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = function(contextType: string) {
  if (contextType === '2d') {
    return new MockContext2D();
  }
  return null;
};

// Mock window.URL.createObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

global.IntersectionObserver = MockIntersectionObserver as any;

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

global.ResizeObserver = MockResizeObserver as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock console methods to keep test output clean
const originalConsoleError = console.error;
console.error = (...args) => {
  if (/Warning.*not wrapped in act/.test(args[0])) {
    return;
  }
  originalConsoleError(...args);
};

// Reset all mocks after each test
beforeEach(() => {
  jest.clearAllMocks();
});