export const emailUPP = (req,res,next)=>{
  const email = (req.body?.email || '').trim();
  if(!/@upp\.edu\.mx$/i.test(email)) return res.status(422).json({error:'Email debe ser @upp.edu.mx'});
  next();
};
export default { emailUPP };
