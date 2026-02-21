import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize i18n - this sets up the translation context
import './lib/i18n';

// Initialize Tailwind CSS
import './index.css';



const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<h1 style="color:red;padding:20px;">Error: Root element not found! Check HTML structure.</h1>';
} else {
  console.log('Root element found, rendering...');
  try {
    const root = ReactDOM.createRoot(rootElement);

    // First render a simple test
    root.render(<h1 style={{padding: '20px'}}>App Starting...</h1>);

    // Then render the actual app
    setTimeout(() => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }, 100);
  } catch (error) {
    console.error('Render error:', error);
    document.body.innerHTML = '<h1 style="color:red;padding:20px;">React Render Error: ' + error.message + '</h1>';
  }
}

