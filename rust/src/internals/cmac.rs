//! `internals/cmac.rs`: Cipher-based Message Authentication Code

use super::{Block, BlockCipher, BLOCK_SIZE};
use super::xor;

type Tag = Block;

/// Cipher-based Message Authentication Code
pub struct Cmac<C: BlockCipher> {
    cipher: C,
    subkey1: Block,
    subkey2: Block,
    state: Block,
    state_pos: usize,
    finished: bool,
}

impl<C: BlockCipher> Cmac<C> {
    /// Create a new CMAC instance with the given cipher
    #[inline]
    pub fn new(cipher: C) -> Self {
        let mut subkey1 = Block::new();
        cipher.encrypt(&mut subkey1);
        subkey1.dbl();

        let mut subkey2 = subkey1.clone();
        subkey2.dbl();

        Self {
            subkey1: subkey1,
            subkey2: subkey2,
            state: Block::new(),
            cipher: cipher,
            state_pos: 0,
            finished: false,
        }
    }

    /// Reset a CMAC instance back to its initial state
    #[inline]
    pub fn reset(&mut self) {
        self.state.clear();
        self.state_pos = 0;
        self.finished = false;
    }

    /// Update the CMAC state with the given message
    ///
    /// Panics if we're already in a finished state (must reset before reusing)
    pub fn update(&mut self, msg: &[u8]) {
        if self.finished {
            panic!("already finished");
        }

        let mut msg_pos: usize = 0;
        let mut msg_len: usize = msg.len();
        let remaining = BLOCK_SIZE - self.state_pos;

        if msg_len > remaining {
            xor::in_place(
                &mut self.state.as_mut()[self.state_pos..],
                &msg[..remaining],
            );

            msg_len = msg_len.checked_sub(remaining).expect("underflow");
            msg_pos = msg_pos.checked_add(remaining).expect("overflow");

            self.cipher.encrypt(&mut self.state);
            self.state_pos = 0;
        }

        while msg_len > BLOCK_SIZE {
            self.state.xor_in_place(
                array_ref!(msg, msg_pos, BLOCK_SIZE),
            );

            msg_len = msg_len.checked_sub(BLOCK_SIZE).expect("underflow");
            msg_pos = msg_pos.checked_add(BLOCK_SIZE).expect("overflow");

            self.cipher.encrypt(&mut self.state);
        }

        if msg_len > 0 {
            let state_end = self.state_pos.checked_add(msg_len).expect("overflow");

            xor::in_place(
                &mut self.state.as_mut()[self.state_pos..state_end],
                &msg[msg_pos..msg_pos.checked_add(msg_len).expect("overflow")],
            );

            self.state_pos = self.state_pos.checked_add(msg_len).expect("overflow");
        }
    }

    /// Finish computing CMAC, returning the computed tag
    ///
    /// Panics if we're already in a finished state (must reset before reusing)
    pub fn finish(&mut self) -> Tag {
        if self.finished {
            panic!("already finished");
        }

        if self.state_pos == BLOCK_SIZE {
            self.state.xor_in_place(&self.subkey1);
        } else {
            self.state.xor_in_place(&self.subkey2);
        };

        if self.state_pos < BLOCK_SIZE {
            self.state.as_mut()[self.state_pos] ^= 0x80;
        }

        self.cipher.encrypt(&mut self.state);
        self.finished = true;

        self.state.clone()
    }
}
