import { createContext, forwardRef, memo, useCallback, useContext, useRef, useEffect,
	useLayoutEffect, useState, } from 'react';
import PropTypes from 'prop-types';
import { flip, size, shift, useFloating } from '@floating-ui/react-dom';
import cx from 'classnames';

import { useFocusManager, usePrevious } from '../hooks';
import { Button } from './button';
import { pick } from '../utils/immutable';
import { isTriggerEvent } from '../utils/event';

export const DropdownContext = createContext({});

export const Dropdown = memo(props => {
	const ref = useRef(null);
	const isKeyboardTrigger = useRef(false);
	const { disabled, isOpen, onToggle, className, placement = 'bottom-start', maxHeight, ...rest } = props;
	const wasOpen = usePrevious(isOpen);
	const [isReady, setIsReady] = useState(false);
	const middleware = [flip({ fallbackAxisSideDirection: 'end' }), shift()];
	// `maxHeight` can be a number in px or if is set to true, use the available height minus some padding
	if (maxHeight) {
		middleware.push(size({
			apply({ availableHeight, elements }) {
				Object.assign(elements.floating.style, {
					overflow: 'auto',
					maxHeight: typeof (maxHeight) === 'number' ? `${maxHeight}px` : `${availableHeight - 8}px`,
				});
			}
		}));
	}

	const { x, y, refs, strategy, update } = useFloating({ placement, middleware });

	const handleToggle = useCallback(ev => {
		if(disabled) {
			return;
		}

		if (isTriggerEvent(ev) || (ev.type === 'keydown' && (['ArrowUp', 'ArrowDown', 'Escape', 'Enter', 'Tab', ' '].includes(ev.key)))) {
			if(!isOpen && (ev.key === 'Tab' || ev.key === 'Escape')) {
				return;
			}

			isKeyboardTrigger.current = ev.type === 'keydown';

			setIsReady(false);
			onToggle?.(ev);
			if(ev.key !== 'Tab') {
				ev.stopPropagation();
				ev.preventDefault();
			}
		}
	}, [disabled, isOpen, onToggle]);

	const handleDocumentEvent = useCallback(ev => {

		if(ev.type === 'click' && ev.button === 2) {
			return;
		}

		if(ev.type === 'keyup' && ev.key !== 'Tab') {
			return;
		}

		if(ev.target?.closest?.('.dropdown') === ref.current) {
			return;
		}

		onToggle?.(ev);

	}, [onToggle]);

	useLayoutEffect(() => {
		if (isOpen !== wasOpen && typeof wasOpen !== 'undefined') {
			update();
			setIsReady(true);
		}
	}, [isOpen, update, wasOpen]);

	useEffect(() => {
		if(isOpen && !wasOpen) {
			ref.current.querySelector('[role="menu"]')?.focus();
		}
		if(wasOpen && !isOpen) {
			ref.current.querySelector('[aria-haspopup="true"]')?.focus();
		}
	}, [isOpen, wasOpen]);

	useEffect(() => {
		if(isOpen) {
			['click', 'touchstart'].forEach(evType =>
				document.addEventListener(evType, handleDocumentEvent, true)
			);
		} else {
			['click', 'touchstart', 'keyup'].forEach(evType =>
				document.removeEventListener(evType, handleDocumentEvent, true)
			);
		}

		return () => {
			['click', 'touchstart', 'keyup'].forEach(evType =>
				document.removeEventListener(evType, handleDocumentEvent, true)
			);
		}

	}, [isOpen, handleDocumentEvent]);

	return (
		<DropdownContext.Provider
			value={{ handleToggle, isOpen, x, y, refs, strategy, update, isReady }}>
				<div
					ref={ref}
					className={cx('dropdown', className, {
						'show': isOpen,
					})}
					{...pick(rest, p => p.startsWith('data-'))}
				>
					{props.children}
				</div>
		</DropdownContext.Provider>
	)
});

Dropdown.displayName = 'Dropdown';

Dropdown.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    isOpen: PropTypes.bool,
    maxHeight: PropTypes.number,
    modifiers: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.object), PropTypes.object]),
    onToggle: PropTypes.func,
    placement: PropTypes.string
};

export const DropdownToggle = memo(forwardRef((props, ref) => {
	const { className, tabIndex, title, onKeyDown, onClick, ...rest } = props;
	const Tag = props.tag || Button;
	const { isOpen, refs, handleToggle } = useContext(DropdownContext);


	const handleClick = useCallback(ev => {
		onClick?.(ev);
		if (!ev.defaultPrevented) {
			handleToggle(ev);
		}
	}, [handleToggle, onClick]);

	const handleKeyDown = useCallback(ev => {
		onKeyDown?.(ev);

		if (['ArrowUp', 'ArrowDown', 'Escape', 'Enter', 'Tab', ' '].includes(ev.key)) {
			handleToggle(ev);
		}

	}, [handleToggle, onKeyDown]);

	return (
		<Tag
			{ ...rest }
			title={ title }
			aria-expanded={ isOpen }
			aria-haspopup={ true }
			className={ className }
			onClick={ handleClick }
			onKeyDown={ handleKeyDown }
			ref={r => { refs.setReference?.(r); ref instanceof Function ? ref(r) : ref ? ref.current = r : null } }
			tabIndex={ tabIndex }
		>
			{props.children}
		</Tag>
	)
}));

DropdownToggle.displayName = 'DropdownToggle';

DropdownToggle.propTypes = {
	tag: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    children: PropTypes.node,
    className: PropTypes.string,
    onClick: PropTypes.func,
    onKeyDown: PropTypes.func,
    tabIndex: PropTypes.number,
    title: PropTypes.string,
};

export const DropdownMenu = memo(props => {
	const { className, ...rest } = props;
	const ref = useRef(null);

	const { isOpen, x, y, isReady, strategy, refs, handleToggle } = useContext(DropdownContext);
	const { focusNext, focusPrev, receiveBlur, receiveFocus, resetLastFocused } = useFocusManager(ref, { initialQuerySelector: '[role="menuitem"]' });
	const wasOpen = usePrevious(isOpen);

	const handleKeyDown = useCallback(ev => {
		if (ev.key === 'ArrowDown') {
			focusNext(ev, { useCurrentTarget: false });
			ev.stopPropagation();
		} else if (ev.key === 'ArrowUp') {
			focusPrev(ev, { useCurrentTarget: false });
			ev.stopPropagation();
		} else if (ev.key === 'Escape' || ev.key === 'Tab') {
			handleToggle(ev);
		}
	}, [focusNext, focusPrev, handleToggle]);

	const handleReceiveFocus = useCallback(ev => {
		if(ev.target !== ev.currentTarget) {
			ev.stopPropagation();
			return;
		}
		receiveFocus(ev);
	}, [receiveFocus]);

	useEffect(() => {
		if(wasOpen && !isOpen) {
			resetLastFocused();
		}
	}, [isOpen, resetLastFocused, wasOpen]);

	return (
		<div
			suppressHydrationWarning={true}
			role="menu"
			aria-hidden={!isOpen}
			ref={ r => { refs.setFloating(r); ref.current = r } }
			style={{ position: strategy, transform: (isOpen && isReady) ? `translate3d(${x}px, ${y}px, 0px)` : ''}}
			className={cx('dropdown-menu', className, {
				'show': (isOpen && isReady),
			})}
			tabIndex={-1}
			onFocus={handleReceiveFocus}
			onBlur={receiveBlur}
			onKeyDown={handleKeyDown}
			{...pick(rest, p => p.startsWith('data-') || p.startsWith('aria-'))}
		>
			{props.children}
		</div>
	);
});

DropdownMenu.displayName = 'DropdownMenu';

DropdownMenu.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    isOpen: PropTypes.bool,
    keepOpenOnInteraction: PropTypes.bool,
    right: PropTypes.bool,
    tabIndex: PropTypes.string
};

export const DropdownItem = memo(props => {
	const ref = useRef(null);
	const { children, className, onClick, disabled = false, role = 'menuitem', tag, divider, ...rest } = props;
	const Tag = tag ?? (divider ? 'div' : 'button');

	const { handleToggle } = useContext(DropdownContext);

	const handleKeyDown = useCallback(ev => {
		if (disabled) {
			return;
		}
		// onKeyDown?.(ev);

		if (ev.key === ' ' || ev.key === 'Enter') {
			if (tag === 'a') {
				ref.current.click();
				ev.preventDefault();
				return;
			}
			onClick?.(ev);

			if (!ev.defaultPrevented) {
				setTimeout(() => handleToggle(ev), 0);
			}
			ev.preventDefault();
		}
	}, [disabled, handleToggle, onClick, tag]);

	const handleClick = useCallback(ev => {
		if (disabled) {
			return;
		}
		onClick?.(ev);
		if (!ev.defaultPrevented) {
			// make sure default behaviour such as clicking a link runs first, then close the dropdown
			setTimeout(() => handleToggle(ev), 0);
		}
	}, [disabled, handleToggle, onClick]);

	return (
		<Tag
			{...rest}
			className={cx(className, {
				'disabled': disabled,
				'dropdown-item': !divider,
				'dropdown-divider': divider,
			})}
			disabled={ Tag === 'button' ? disabled : null }
			onClick={ handleClick }
			onKeyDown={ handleKeyDown }
			tabIndex={divider ? null : -2}
			role={ role }
			ref={ ref }
		>
			{ children }
		</Tag>
	)
});

DropdownItem.displayName = 'DropdownItem';

DropdownItem.propTypes = {
	disabled: PropTypes.bool,
	divider: PropTypes.bool,
	role: PropTypes.string,
    children: PropTypes.node,
    className: PropTypes.string,
    onClick: PropTypes.func,
    tag: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
};

export const UncontrolledDropdown = memo(props => {
	const [isOpen, setIsOpen] = useState(false);

	const handleToggleDropdown = useCallback(() => {
		setIsOpen(isOpen => !isOpen);
	}, []);

	return (
		<Dropdown
			{...props}
			onToggle={ handleToggleDropdown }
			isOpen={ isOpen }
		>
			{ props.children }
		</Dropdown>
	);
});

UncontrolledDropdown.displayName = 'UncontrolledDropdown';

UncontrolledDropdown.propTypes = {
	children: PropTypes.node,
}

