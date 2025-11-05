export default function Badge({ tone='purple', children }){
  return <span className={`badge ${tone}`}>{children}</span>;
}
