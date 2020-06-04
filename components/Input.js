import React, { useRef } from 'react';

import "./Input.scss";

// event object contains info about details of the event
const Input = (props) => {
    const input = useRef()
    const sendButton = useRef()

    if (!props.focus) {
        if (input.current) {
            input.current.blur()
        }
        if (sendButton.current) {
            sendButton.current.blur()
        }
    }

    return (
        <form className="form">
            <input
                ref={input}
                className="input"
                type="text"
                placeholder="Type a message..."
                value={props.message}
                onChange={(event) => props.setMessage(event.target.value)}
                onKeyPress={(event) => event.key === 'Enter' ? props.sendMessage(event) : null}
            />
            <button ref={sendButton} className="sendButton" onClick={(event) => props.sendMessage(event)}>Send</button>
        </form>
    );
};

export default Input;