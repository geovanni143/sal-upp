USE sal_upp;

-- Cambia el ENUM para que solo existan 'superadmin' y 'docente'
ALTER TABLE users
  MODIFY role ENUM('superadmin','docente') DEFAULT 'docente';
