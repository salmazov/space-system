#include "SpaceSystemHUD.h"
#include "SpaceSystemLevelActor.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
	const FSlateColor HUDTextColor = FSlateColor(FLinearColor(0.82f, 0.9f, 1.0f));
	const FSlateColor DimTextColor = FSlateColor(FLinearColor(0.5f, 0.6f, 0.7f));
	const FSlateColor AccentColor = FSlateColor(FLinearColor(0.3f, 0.82f, 0.78f));
	const FMargin PanelPadding(12.0f, 8.0f);
	const FSlateBrush PanelBrush = *FCoreStyle::Get().GetBrush("GenericWhiteBox");

	FLinearColor PanelBackground() { return FLinearColor(0.02f, 0.04f, 0.08f, 0.88f); }
	FLinearColor ButtonBackground() { return FLinearColor(0.08f, 0.14f, 0.22f, 0.92f); }
}

void SSpaceSystemHUD::Construct(const FArguments& InArgs)
{
	OnTrade = InArgs._OnTrade;
	OnTravel = InArgs._OnTravel;
	OnSos = InArgs._OnSos;
	OnShareFuel = InArgs._OnShareFuel;

	ChildSlot
	[
		SNew(SOverlay)

		// Resource bar — top center
		+ SOverlay::Slot()
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Top)
		.Padding(0.0f, 12.0f, 0.0f, 0.0f)
		[
			BuildResourceBar()
		]

		// Hint text — below resource bar
		+ SOverlay::Slot()
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Top)
		.Padding(0.0f, 56.0f, 0.0f, 0.0f)
		[
			SAssignNew(HintTextBlock, STextBlock)
			.ColorAndOpacity(AccentColor)
			.Justification(ETextJustify::Center)
		]

		// Market panel — right side
		+ SOverlay::Slot()
		.HAlign(HAlign_Right)
		.VAlign(VAlign_Center)
		.Padding(0.0f, 0.0f, 16.0f, 0.0f)
		[
			BuildMarketPanel()
		]

		// SOS panel — left side (visible when near SOS signals in space)
		+ SOverlay::Slot()
		.HAlign(HAlign_Left)
		.VAlign(VAlign_Center)
		.Padding(16.0f, 0.0f, 0.0f, 0.0f)
		[
			BuildSosPanel()
		]

		// Minimap — bottom left
		+ SOverlay::Slot()
		.HAlign(HAlign_Left)
		.VAlign(VAlign_Bottom)
		.Padding(16.0f, 0.0f, 0.0f, 16.0f)
		[
			BuildMiniMap()
		]
	];
}

TSharedRef<SWidget> SSpaceSystemHUD::BuildResourceBar()
{
	return SNew(SBorder)
		.BorderImage(&PanelBrush)
		.BorderBackgroundColor(PanelBackground())
		.Padding(PanelPadding)
		[
			SAssignNew(ResourceText, STextBlock)
			.ColorAndOpacity(HUDTextColor)
			.Justification(ETextJustify::Center)
		];
}

TSharedRef<SWidget> SSpaceSystemHUD::BuildMarketPanel()
{
	return SAssignNew(MarketPanel, SBorder)
		.BorderImage(&PanelBrush)
		.BorderBackgroundColor(PanelBackground())
		.Padding(PanelPadding)
		.Visibility(EVisibility::Collapsed)
		[
			SNew(SBox)
			.WidthOverride(340.0f)
			.MaxDesiredHeight(520.0f)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					SAssignNew(MarketBox, SVerticalBox)
				]
			]
		];
}

TSharedRef<SWidget> SSpaceSystemHUD::BuildSosPanel()
{
	return SAssignNew(SosPanel, SBorder)
		.BorderImage(&PanelBrush)
		.BorderBackgroundColor(PanelBackground())
		.Padding(PanelPadding)
		.Visibility(EVisibility::Collapsed)
		[
			SNew(SBox)
			.WidthOverride(300.0f)
			.MaxDesiredHeight(400.0f)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					SAssignNew(SosBox, SVerticalBox)
				]
			]
		];
}

TSharedRef<SWidget> SSpaceSystemHUD::BuildMiniMap()
{
	// Minimap placeholder — a simple bordered area that shows key info as text.
	// A full custom-paint minimap can be added later with OnPaint override.
	return SNew(SBorder)
		.BorderImage(&PanelBrush)
		.BorderBackgroundColor(PanelBackground())
		.Padding(8.0f)
		[
			SNew(SBox)
			.WidthOverride(200.0f)
			.HeightOverride(140.0f)
			[
				SNew(STextBlock)
				.ColorAndOpacity(DimTextColor)
				.Text(FText::FromString(TEXT("Minimap\n(strategy view)")))
				.Justification(ETextJustify::Center)
			]
		];
}

void SSpaceSystemHUD::UpdateState(
	const FSpaceSystemShipView* OwnShip,
	const TArray<FSpaceSystemPlanetView>& Planets,
	const TArray<FSpaceSystemShipView>& Ships,
	const TArray<FSpaceSystemStoreView>& Stores,
	const TArray<FSpaceSystemExploredAreaView>& ExploredAreas,
	const TArray<FSpaceSystemSosSignalView>& SosSignals,
	const FString& ConnectionStatus,
	const FString& HintText,
	const FString& ClientId,
	int32 Tick)
{
	CachedOwnShip = OwnShip;
	CachedPlanets = &Planets;
	CachedShips = &Ships;
	CachedStores = &Stores;
	CachedExploredAreas = &ExploredAreas;
	CachedSosSignals = &SosSignals;
	CachedConnectionStatus = ConnectionStatus;
	CachedHintText = HintText;
	CachedClientId = ClientId;
	CachedTick = Tick;

	// Update resource bar
	if (ResourceText.IsValid())
	{
		if (OwnShip)
		{
			int32 CargoTotal = 0;
			for (const auto& Pair : OwnShip->Cargo)
			{
				CargoTotal += Pair.Value;
			}

			const float FuelRatio = OwnShip->FuelCapacity > 0.0f ? OwnShip->Fuel / OwnShip->FuelCapacity : 0.0f;
			const bool bHasSosSignal = CachedSosSignals && CachedSosSignals->ContainsByPredicate([&ClientId](const FSpaceSystemSosSignalView& S) { return S.ClientId == ClientId; });
			const FString SosLabel = bHasSosSignal ? TEXT("  |  SOS ACTIVE") : (FuelRatio <= 0.12f && OwnShip->LocationPlanetId.IsEmpty() ? TEXT("  |  [SOS Available]") : TEXT(""));

			const FString ResourceStr = FString::Printf(
				TEXT("Credits: %.0f  |  Fuel: %.0f/%.0f  |  HP: %d%%  |  Cargo: %d/%d  |  %s  |  Tick %d%s"),
				OwnShip->Credits,
				OwnShip->Fuel,
				OwnShip->FuelCapacity,
				FMath::RoundToInt(OwnShip->Health * 100.0f),
				CargoTotal,
				OwnShip->CargoCapacity,
				OwnShip->LocationPlanetId.IsEmpty() ? TEXT("In transit") : *OwnShip->LocationPlanetId,
				Tick,
				*SosLabel
			);
			ResourceText->SetText(FText::FromString(ResourceStr));
		}
		else
		{
			ResourceText->SetText(FText::FromString(FString::Printf(TEXT("%s  |  Tick %d"), *ConnectionStatus, Tick)));
		}
	}

	// Update hint text
	if (HintTextBlock.IsValid())
	{
		HintTextBlock->SetText(FText::FromString(HintText));
	}

	// Show/hide market panel
	const bool bIsDocked = OwnShip && !OwnShip->LocationPlanetId.IsEmpty();
	if (MarketPanel.IsValid())
	{
		MarketPanel->SetVisibility(bIsDocked ? EVisibility::Visible : EVisibility::Collapsed);
	}

	if (bIsDocked)
	{
		RebuildMarketContent();
	}

	// Show SOS panel when near distress signals in space
	const bool bInSpace = OwnShip && OwnShip->LocationPlanetId.IsEmpty();
	bool bHasNearbySos = false;
	if (bInSpace && CachedSosSignals)
	{
		constexpr float FuelShareDistance = 1.8f;
		for (const FSpaceSystemSosSignalView& Signal : *CachedSosSignals)
		{
			if (Signal.ClientId == ClientId) continue;
			const float Dist = FVector2D::Distance(OwnShip->MapPosition, Signal.MapPosition);
			if (Dist <= FuelShareDistance)
			{
				bHasNearbySos = true;
				break;
			}
		}
	}

	if (SosPanel.IsValid())
	{
		SosPanel->SetVisibility(bHasNearbySos ? EVisibility::Visible : EVisibility::Collapsed);
	}

	if (bHasNearbySos)
	{
		RebuildSosContent();
	}
}

void SSpaceSystemHUD::RebuildMarketContent()
{
	if (!MarketBox.IsValid() || !CachedOwnShip || !CachedStores)
	{
		return;
	}

	MarketBox->ClearChildren();

	// Header
	MarketBox->AddSlot()
	.AutoHeight()
	.Padding(0.0f, 0.0f, 0.0f, 8.0f)
	[
		SNew(STextBlock)
		.ColorAndOpacity(AccentColor)
		.Text(FText::FromString(FString::Printf(TEXT("Market — %s"), *CachedOwnShip->LocationPlanetId)))
	];

	// Find the store for the docked planet
	const FSpaceSystemStoreView* DockedStore = nullptr;
	for (const FSpaceSystemStoreView& Store : *CachedStores)
	{
		if (Store.Id.Contains(CachedOwnShip->LocationPlanetId))
		{
			DockedStore = &Store;
			break;
		}
	}

	if (!DockedStore)
	{
		MarketBox->AddSlot()
		.AutoHeight()
		[
			SNew(STextBlock)
			.ColorAndOpacity(DimTextColor)
			.Text(FText::FromString(TEXT("No store data available")))
		];
		return;
	}

	// Show each good with buy/sell buttons
	for (const FSpaceSystemStoreGoodView& Good : DockedStore->Goods)
	{
		const int32* OwnedPtr = CachedOwnShip->Cargo.Find(Good.GoodId);
		const int32 Owned = OwnedPtr ? *OwnedPtr : 0;
		const FString GoodId = Good.GoodId;

		MarketBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 2.0f)
		[
			SNew(SHorizontalBox)

			+ SHorizontalBox::Slot()
			.FillWidth(1.0f)
			.VAlign(VAlign_Center)
			[
				SNew(STextBlock)
				.ColorAndOpacity(HUDTextColor)
				.Text(FText::FromString(FString::Printf(TEXT("%s  $%.0f  stock:%d  owned:%d"), *Good.Label, Good.Price, Good.Stock, Owned)))
			]

			+ SHorizontalBox::Slot()
			.AutoWidth()
			.Padding(4.0f, 0.0f)
			[
				SNew(SButton)
				.OnClicked_Lambda([this, GoodId]()
				{
					OnTrade.ExecuteIfBound(GoodId, true, 1);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(FText::FromString(TEXT("Buy 1")))
				]
			]

			+ SHorizontalBox::Slot()
			.AutoWidth()
			.Padding(2.0f, 0.0f)
			[
				SNew(SButton)
				.OnClicked_Lambda([this, GoodId]()
				{
					OnTrade.ExecuteIfBound(GoodId, true, 5);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(FText::FromString(TEXT("Buy 5")))
				]
			]

			+ SHorizontalBox::Slot()
			.AutoWidth()
			.Padding(4.0f, 0.0f)
			[
				SNew(SButton)
				.OnClicked_Lambda([this, GoodId]()
				{
					OnTrade.ExecuteIfBound(GoodId, false, 1);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(FText::FromString(TEXT("Sell 1")))
				]
			]

			+ SHorizontalBox::Slot()
			.AutoWidth()
			[
				SNew(SButton)
				.OnClicked_Lambda([this, GoodId]()
				{
					OnTrade.ExecuteIfBound(GoodId, false, 5);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(FText::FromString(TEXT("Sell 5")))
				]
			]
		];
	}

	// Travel buttons to other planets
	if (CachedPlanets)
	{
		MarketBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 12.0f, 0.0f, 4.0f)
		[
			SNew(STextBlock)
			.ColorAndOpacity(AccentColor)
			.Text(FText::FromString(TEXT("Travel")))
		];

		for (const FSpaceSystemPlanetView& Planet : *CachedPlanets)
		{
			if (Planet.Id == CachedOwnShip->LocationPlanetId)
			{
				continue;
			}

			const FString PlanetId = Planet.Id;

			MarketBox->AddSlot()
			.AutoHeight()
			.Padding(0.0f, 1.0f)
			[
				SNew(SButton)
				.OnClicked_Lambda([this, PlanetId]()
				{
					OnTravel.ExecuteIfBound(PlanetId);
					return FReply::Handled();
				})
				[
					SNew(STextBlock)
					.ColorAndOpacity(HUDTextColor)
					.Text(FText::FromString(FString::Printf(TEXT("Travel to %s"), *Planet.Name)))
				]
			];
		}
	}
}

void SSpaceSystemHUD::RebuildSosContent()
{
	if (!SosBox.IsValid() || !CachedOwnShip || !CachedSosSignals)
	{
		return;
	}

	SosBox->ClearChildren();

	SosBox->AddSlot()
	.AutoHeight()
	.Padding(0.0f, 0.0f, 0.0f, 8.0f)
	[
		SNew(STextBlock)
		.ColorAndOpacity(AccentColor)
		.Text(FText::FromString(TEXT("Nearby Distress Signals")))
	];

	// SOS button for own ship
	const float FuelRatio = CachedOwnShip->FuelCapacity > 0.0f ? CachedOwnShip->Fuel / CachedOwnShip->FuelCapacity : 0.0f;
	const bool bCanSos = CachedOwnShip->LocationPlanetId.IsEmpty() && FuelRatio <= 0.12f;
	const bool bHasOwnSos = CachedSosSignals->ContainsByPredicate([this](const FSpaceSystemSosSignalView& S) { return S.ClientId == CachedClientId; });

	if (bCanSos && !bHasOwnSos)
	{
		SosBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 2.0f)
		[
			SNew(SButton)
			.OnClicked_Lambda([this]()
			{
				OnSos.ExecuteIfBound();
				return FReply::Handled();
			})
			[
				SNew(STextBlock)
				.ColorAndOpacity(FSlateColor(FLinearColor(1.0f, 0.6f, 0.15f)))
				.Text(FText::FromString(TEXT("Broadcast SOS")))
			]
		];
	}

	constexpr float FuelShareDistance = 1.8f;
	constexpr int32 ShareQty = 5;

	for (const FSpaceSystemSosSignalView& Signal : *CachedSosSignals)
	{
		if (Signal.ClientId == CachedClientId) continue;

		const float Dist = FVector2D::Distance(CachedOwnShip->MapPosition, Signal.MapPosition);
		if (Dist > FuelShareDistance) continue;

		const FString TargetClientId = Signal.ClientId;
		const float Reserve = FMath::Max(4.0f, CachedOwnShip->FuelCapacity * 0.2f);
		const float Shareable = CachedOwnShip->Fuel - Reserve;
		const bool bCanShare = Shareable >= static_cast<float>(ShareQty);

		SosBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 2.0f)
		[
			SNew(SHorizontalBox)

			+ SHorizontalBox::Slot()
			.FillWidth(1.0f)
			.VAlign(VAlign_Center)
			[
				SNew(STextBlock)
				.ColorAndOpacity(HUDTextColor)
				.Text(FText::FromString(FString::Printf(TEXT("%s needs %.0f fuel"), *Signal.ShipName, Signal.FuelNeeded)))
			]

			+ SHorizontalBox::Slot()
			.AutoWidth()
			.Padding(4.0f, 0.0f)
			[
				SNew(SButton)
				.IsEnabled(bCanShare)
				.OnClicked_Lambda([this, TargetClientId]()
				{
					OnShareFuel.ExecuteIfBound(TargetClientId, 5);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("Share %d Fuel"), ShareQty)))
				]
			]
		];
	}
}
