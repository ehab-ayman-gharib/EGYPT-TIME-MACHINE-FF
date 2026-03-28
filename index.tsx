/**
 * REACT ENTRY POINT
 * -----------------
 * This file bootstraps the React application by finding the 'root' element
 * in index.html and mounting the main <App /> component.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);