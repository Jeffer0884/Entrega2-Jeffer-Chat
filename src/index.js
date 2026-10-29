// Archivo principal del proyecto original: Express + Handlebars.
// El chat se integró aquí, sin crear una segunda aplicación Node.
import express from 'express';
import handlebars from 'express-handlebars';
import { __dirname } from './util.js';
import path from 'node:path';
import { registrarChat } from './chat/realtime.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.engine('handlebars', handlebars.engine());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// La ruta principal ahora solicita los datos antes de entrar al chat.
app.get('/', (req, res) => {
  res.render('index', { title: 'Ingresar · ChatApp', page: 'join' });
});

// Todos llegan primero al chat global; los privados son opcionales.
app.get('/chat', (req, res) => {
  res.render('chat', { title: 'Chat global · ChatApp', page: 'chat' });
});

// Se conserva la página original de la práctica de motores de plantillas.
app.get('/ejemplo', (req, res) => {
  const products = [
    { name_product: 'Hamburger chimbisecchions', price: 10 },
    { name_product: 'Coke', price: 3 },
    { name_product: 'Pancake', price: 8 }
  ];
  res.render('ejemplo', { title: 'Motores', username: 'Muchachos', admin: true, product: products });
});

// Ruta /contact de la clase conservada.
app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Motores/contacto', dato: 'Por jugar' });
});

// Endpoints de mensajes, usuarios conectados y actualizaciones en tiempo real.
registrarChat(app);

app.listen(port, '0.0.0.0', () => {
  console.log(`Chat global disponible en http://localhost:${port}`);
  console.log('Ejemplo original disponible en http://localhost:' + port + '/ejemplo');
});
