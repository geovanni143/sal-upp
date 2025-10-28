import jwt from "jsonwebtoken";
const JWT_EXP_MIN = parseInt(process.env.JWT_EXP_MIN || "60", 10);

export function signToken(payload){
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${JWT_EXP_MIN}m` });
}
export function verifyToken(token){
  return jwt.verify(token, process.env.JWT_SECRET);
}
