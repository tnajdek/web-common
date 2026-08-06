import { Section } from '../section';
import { Spinner } from '../../components/spinner';

export function SpinnerSection() {
	return (
		<Section title="Spinner (size presets, geometry driven by CSS)">
			<div className="row">
				<Spinner small />
				<span className="label">small — 16, radius 7, stroke 2 (hairline 7.5/1 on ≥2x screens)</span>
			</div>
			<div className="row">
				<Spinner />
				<span className="label">default — 24, radius 11, stroke 2</span>
			</div>
			<div className="row">
				<Spinner large />
				<span className="label">large — 32, radius 14.5, stroke 3</span>
			</div>
			<div className="row">
				<Spinner xlarge />
				<span className="label">xlarge — 52, radius 24, stroke 4</span>
			</div>
		</Section>
	);
}
