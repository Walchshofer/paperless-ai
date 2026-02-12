import { h, ComponentChildren } from 'preact';

interface ModelCardGroupProps {
  id: string;
  title: string;
  description?: string;
  children: ComponentChildren;
  testId: string;
}

/**
 * ModelCardGroup - Group container for ModelCards.
 * Renders a titled section with a responsive grid of model cards.
 */
export function ModelCardGroup({
  id,
  title,
  description,
  children,
  testId,
}: ModelCardGroupProps) {
  return (
    <section
      id={id}
      className="mc-group"
      data-testid={testId}
      role="group"
      aria-label={title}
    >
      <div className="mc-group-header">
        <h4 className="mc-group-title">{title}</h4>
        {description && <p className="mc-group-desc">{description}</p>}
      </div>
      <div className="mc-grid">
        {children}
      </div>
    </section>
  );
}
