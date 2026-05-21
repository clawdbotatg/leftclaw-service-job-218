// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PizzaSliceMinter
 * @notice Burn 50,000 CLAWD to mint a unique Pizza Slice ERC-721 NFT during a 24-hour event window.
 * @dev Holds no funds; CLAWD is sent directly from the user to the dead address.
 */
contract PizzaSliceMinter is ERC721URIStorage, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Amount of CLAWD burned per mint (50,000 with 18 decimals).
    uint256 public constant BURN_AMOUNT = 50_000 * 10 ** 18;

    /// @notice Hardcoded burn destination. Never configurable.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice The CLAWD ERC-20 token.
    IERC20 public immutable clawdToken;

    /// @notice Cumulative CLAWD burned per minter.
    mapping(address => uint256) public totalBurned;

    /// @notice Number of slices minted per address.
    mapping(address => uint256) public mintCount;

    /// @notice Total CLAWD burned through this contract.
    uint256 public totalCLAWDBurned;

    /// @notice Total slices minted.
    uint256 public totalMinted;

    /// @notice Event window start (unix timestamp, inclusive).
    uint256 public eventStart;

    /// @notice Event window end (unix timestamp, inclusive).
    uint256 public eventEnd;

    /// @dev Next token id to mint. Starts at 0.
    uint256 private _nextTokenId;

    event SliceMinted(address indexed minter, uint256 indexed tokenId, string tokenURI);
    event CLAWDBurned(address indexed minter, uint256 amount);
    event EventStartUpdated(uint256 newEventStart);
    event EventEndUpdated(uint256 newEventEnd);

    error EventNotStarted();
    error EventEnded();
    error EventAlreadyStarted();
    error InvalidWindow();
    error ZeroAddress();

    constructor(address _clawdToken, uint256 _eventStart, uint256 _eventEnd, address initialOwner)
        ERC721("Pizza Slice", "SLICE")
        Ownable(initialOwner)
    {
        if (_clawdToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        if (_eventEnd <= _eventStart) revert InvalidWindow();

        clawdToken = IERC20(_clawdToken);
        eventStart = _eventStart;
        eventEnd = _eventEnd;
    }

    /**
     * @notice Burn `BURN_AMOUNT` CLAWD and mint a Pizza Slice NFT.
     * @param tokenURI The metadata URI for the freshly minted slice.
     */
    function mint(string calldata tokenURI) external nonReentrant {
        if (block.timestamp < eventStart) revert EventNotStarted();
        if (block.timestamp > eventEnd) revert EventEnded();

        // CEI: update all state first, then external token transfer.
        uint256 tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
            totalBurned[msg.sender] += BURN_AMOUNT;
            mintCount[msg.sender] += 1;
            totalCLAWDBurned += BURN_AMOUNT;
            totalMinted += 1;
        }

        // Burn CLAWD by sending it to the dead address.
        clawdToken.safeTransferFrom(msg.sender, BURN_ADDRESS, BURN_AMOUNT);

        // Mint the slice. _safeMint is the last external interaction; all state already updated.
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit CLAWDBurned(msg.sender, BURN_AMOUNT);
        emit SliceMinted(msg.sender, tokenId, tokenURI);
    }

    /**
     * @notice Update the event start. Only allowed before the window opens.
     */
    function setEventStart(uint256 newEventStart) external onlyOwner {
        if (block.timestamp >= eventStart) revert EventAlreadyStarted();
        if (newEventStart >= eventEnd) revert InvalidWindow();
        eventStart = newEventStart;
        emit EventStartUpdated(newEventStart);
    }

    /**
     * @notice Update the event end. Only allowed before the window opens.
     */
    function setEventEnd(uint256 newEventEnd) external onlyOwner {
        if (block.timestamp >= eventStart) revert EventAlreadyStarted();
        if (newEventEnd <= eventStart) revert InvalidWindow();
        eventEnd = newEventEnd;
        emit EventEndUpdated(newEventEnd);
    }

}
