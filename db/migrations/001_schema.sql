CREATE DATABASE IF NOT EXISTS sal_upp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sal_upp;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE,
  role ENUM('superadmin','docente','alumno') DEFAULT 'alumno',
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratorios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  edificio VARCHAR(20),
  piso VARCHAR(10)
);

-- Admin: admin / admin123  (bcrypt hash)
INSERT INTO users (username,password_hash,nombre,email,role,activo)
VALUES (
  'admin',
  '.0mB4JdP9mQK7QvU4nM1i3Vb5m9KQqTC',
  'Admin General',
  'admin@upp.edu.mx',
  'superadmin',
  1
)
ON DUPLICATE KEY UPDATE email=VALUES(email);

INSERT INTO laboratorios (nombre,edificio,piso)
VALUES ('Laboratorio de Cómputo 1','A','PB')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
