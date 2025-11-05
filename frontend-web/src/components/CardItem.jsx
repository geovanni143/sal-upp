export default function CardItem({ title, subtitle, right, onEdit, onDelete, onMenu }) {
  return (
    <div className="card-item">
      <div className="ci-left">
        <div className="ci-title">{title}</div>
        {subtitle && <div className="ci-sub">{subtitle}</div>}
      </div>
      <div className="ci-right">
        {right}
        <button className="pill" onClick={onEdit}>EDITAR</button>
        <button className="icon" onClick={onDelete} title="Eliminar">🗑️</button>
        <button className="icon" onClick={onMenu} title="Opciones">≡</button>
      </div>
    </div>
  );
}
