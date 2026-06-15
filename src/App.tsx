import { BrowserRouter } from 'react-router-dom';
import FlowRouter from './components/FlowRouter';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <FlowRouter />
    </BrowserRouter>
  );
}
