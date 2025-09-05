import { render, screen } from '@testing-library/react';

// Sample test to verify Jest setup
describe('Jest Setup', () => {
  it('should render a simple component', () => {
    const TestComponent = () => <div>Test Component</div>;

    render(<TestComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should pass a basic test', () => {
    expect(2 + 2).toBe(4);
  });
});
