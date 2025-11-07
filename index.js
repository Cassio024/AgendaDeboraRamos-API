// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar ao MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelos do Banco de Dados (Schemas) ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  birthDate: { type: Date, required: true },
});
const User = mongoose.model('User', UserSchema);

const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventName: { type: String, required: true },
  venue: { type: String, required: true },
  dateTime: { type: Date, required: true },
  value: { type: Number, default: 0 },
  status: { type: String, default: 'Confirmado' },
  description: { type: String, default: '' }
});
const Event = mongoose.model('Event', EventSchema);


// --- ROTAS DE UTILIZADOR ---
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, birthDate } = req.body; // birthDate é "4/7/2002"

    // --- INÍCIO DA CORREÇÃO ---
    // 1. Vamos dividir a string "4/7/2002" em partes: ["4", "7", "2002"]
    const parts = birthDate.split('/');
    // 2. Agora, criamos um objeto Date no formato correto (Ano, Mês-1, Dia)
    const dateObject = new Date(parts[2], parts[1] - 1, parts[0]);
    // --- FIM DA CORREÇÃO ---

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já está em uso.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 3. Usamos o 'dateObject' corrigido aqui
    const newUser = new User({ name, email, password: hashedPassword, birthDate: dateObject }); 
    await newUser.save();
    res.status(201).json({ message: 'Utilizador criado com sucesso!' });
  } catch (error) {
    // MELHORIA: Adicionado log de erro
    console.error('Erro em /api/users/register:', error);
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/users/login:', error);
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para verificar identidade (email + data de nascimento)
app.post('/api/users/verify-identity', async (req, res) => {
    try {
        const { email, birthDate } = req.body; // birthDate é "4/7/2002"

        // --- INÍCIO DA CORREÇÃO ---
        const parts = birthDate.split('/');
        const dateObject = new Date(parts[2], parts[1] - 1, parts[0]);
        // --- FIM DA CORREÇÃO ---

        const user = await User.findOne({ email, birthDate: dateObject }); // Usamos o dateObject
        if (!user) {
            return res.status(404).json({ message: 'Dados não encontrados.' });
        }
        res.status(200).json({ userId: user._id });
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/users/verify-identity:', error);
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para redefinir a senha
app.post('/api/users/reset-password', async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword });
        if (!updatedUser) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/users/reset-password:', error);
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});

// Rota para um utilizador apagar a sua própria conta
app.delete('/api/users/me/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Senha incorreta.' });
        }
        await Event.deleteMany({ userId: userId });
        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: 'Conta apagada com sucesso.' });
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/users/me/:id:', error);
        res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
});


// --- ROTAS DE EVENTOS ---
app.post('/api/events', async (req, res) => {
    try {
        const { userId, eventName, venue, dateTime, value, status, description } = req.body;
        // NOTA: Se 'dateTime' também vier como string do Flutter, você precisará de uma conversão aqui também.
        const newEvent = new Event({ userId, eventName, venue, dateTime, value, status, description });
        await newEvent.save();
        res.status(201).json(newEvent);
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/events (POST):', error);
        res.status(500).json({ message: 'Erro ao criar evento', error: error.message });
    }
});

app.get('/api/events/:userId', async (req, res) => {
    try {
        const events = await Event.find({ userId: req.params.userId }).sort({ dateTime: 'asc' });
        res.status(200).json(events);
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/events/:userId (GET):', error);
        res.status(500).json({ message: 'Erro ao obter eventos', error: error.message });
    }
});

app.put('/api/events/:id', async (req, res) => {
    try {
        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedEvent) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }
        res.status(200).json(updatedEvent);
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/events/:id (PUT):', error);
        res.status(500).json({ message: 'Erro ao atualizar evento', error: error.message });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const deletedEvent = await Event.findByIdAndDelete(req.params.id);
        if (!deletedEvent) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }
        res.status(200).json({ message: 'Evento apagado com sucesso.' });
    } catch (error) {
        // MELHORIA: Adicionado log de erro
        console.error('Erro em /api/events/:id (DELETE):', error);
        res.status(500).json({ message: 'Erro ao apagar evento', error: error.message });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});