#include "SpaceSystemHUD.h"
#include "SpaceSystemLevelActor.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/SLeafWidget.h"
#include "Rendering/DrawElements.h"

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

class SSpaceSystemMiniMapCanvas : public SLeafWidget
{
public:
	SLATE_BEGIN_ARGS(SSpaceSystemMiniMapCanvas) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs) {}

	void SetData(
		const FSpaceSystemShipView* InOwnShip,
		const TArray<FSpaceSystemPlanetView>* InPlanets,
		const TArray<FSpaceSystemShipView>* InShips,
		const TArray<FSpaceSystemExploredAreaView>* InExploredAreas,
		const FString& InClientId)
	{
		OwnShip = InOwnShip;
		Planets = InPlanets;
		Ships = InShips;
		ExploredAreas = InExploredAreas;
		ClientId = InClientId;
	}

	virtual FVector2D ComputeDesiredSize(float) const override { return FVector2D(220.0, 160.0); }

	virtual int32 OnPaint(
		const FPaintArgs& Args,
		const FGeometry& AllottedGeometry,
		const FSlateRect& MyCullingRect,
		FSlateWindowElementList& OutDrawElements,
		int32 LayerId,
		const FWidgetStyle& InWidgetStyle,
		bool bParentEnabled) const override
	{
		const FSlateBrush* WhiteBrush = FCoreStyle::Get().GetBrush("GenericWhiteBox");
		const ESlateDrawEffect DrawEffects = ESlateDrawEffect::None;
		const FVector2D WidgetSize = AllottedGeometry.GetLocalSize();

		// Map coordinate space
		constexpr float MapMinX = -13.0f, MapMaxX = 43.0f;
		constexpr float MapMinY = -10.0f, MapMaxY = 10.0f;
		constexpr float Pad = 10.0f;

		const float AvailW = static_cast<float>(WidgetSize.X) - 2.0f * Pad;
		const float AvailH = static_cast<float>(WidgetSize.Y) - 2.0f * Pad;
		const float ScaleVal = FMath::Min(AvailW / (MapMaxX - MapMinX), AvailH / (MapMaxY - MapMinY));

		auto MapToLocal = [&](const FVector2D& P) -> FVector2D
		{
			return FVector2D(
				Pad + (P.X - MapMinX) * ScaleVal,
				Pad + (MapMaxY - P.Y) * ScaleVal);
		};

		// Explored area circles
		if (ExploredAreas)
		{
			for (const FSpaceSystemExploredAreaView& Area : *ExploredAreas)
			{
				const FVector2D C = MapToLocal(Area.Center);
				const float R = Area.Radius * ScaleVal;
				constexpr int32 Segs = 32;
				TArray<FVector2D> Pts;
				Pts.Reserve(Segs + 1);
				for (int32 i = 0; i <= Segs; ++i)
				{
					const float Ang = 2.0f * PI * i / Segs;
					Pts.Add(C + FVector2D(FMath::Cos(Ang) * R, FMath::Sin(Ang) * R));
				}
				FSlateDrawElement::MakeLines(OutDrawElements, LayerId,
					AllottedGeometry.ToPaintGeometry(), Pts, DrawEffects,
					FLinearColor(0.08f, 0.35f, 0.42f, 0.6f), true, 1.5f);
			}
		}

		// Trade routes (explored only)
		if (Planets)
		{
			for (int32 i = 1; i < Planets->Num(); ++i)
			{
				const FSpaceSystemPlanetView& A = (*Planets)[i - 1];
				const FSpaceSystemPlanetView& B = (*Planets)[i];
				if (!IsPosExplored(A.MapPosition) || !IsPosExplored(B.MapPosition)) continue;

				TArray<FVector2D> Line;
				Line.Add(MapToLocal(A.MapPosition));
				Line.Add(MapToLocal(B.MapPosition));
				FSlateDrawElement::MakeLines(OutDrawElements, LayerId,
					AllottedGeometry.ToPaintGeometry(), Line, DrawEffects,
					FLinearColor(0.12f, 0.22f, 0.32f, 0.7f), true, 1.0f);
			}
		}

		// Planet dots
		if (Planets)
		{
			for (const FSpaceSystemPlanetView& P : *Planets)
			{
				if (!IsPosExplored(P.MapPosition)) continue;
				const FVector2D Pos = MapToLocal(P.MapPosition);
				const float Sz = 6.0f;
				FSlateDrawElement::MakeBox(OutDrawElements, LayerId + 1,
					AllottedGeometry.ToPaintGeometry(FVector2f(Sz), FSlateLayoutTransform(FVector2f(Pos - FVector2D(Sz * 0.5)))),
					WhiteBrush, DrawEffects, P.Color);
			}
		}

		// Ship dots
		if (Ships)
		{
			for (const FSpaceSystemShipView& S : *Ships)
			{
				const bool bOwn = S.OwnerClientId == ClientId;
				if (!bOwn && !IsPosExplored(S.MapPosition)) continue;
				const FVector2D Pos = MapToLocal(S.MapPosition);
				const float Sz = bOwn ? 5.0f : 3.5f;
				const FLinearColor Col = bOwn
					? FLinearColor(1.0f, 0.3f, 0.2f)
					: FLinearColor(0.4f, 0.7f, 1.0f, 0.8f);
				FSlateDrawElement::MakeBox(OutDrawElements, LayerId + 2,
					AllottedGeometry.ToPaintGeometry(FVector2f(Sz), FSlateLayoutTransform(FVector2f(Pos - FVector2D(Sz * 0.5)))),
					WhiteBrush, DrawEffects, Col);
			}
		}

		return LayerId + 3;
	}

private:
	bool IsPosExplored(const FVector2D& Pos) const
	{
		if (!ExploredAreas || ExploredAreas->Num() == 0) return true;
		for (const FSpaceSystemExploredAreaView& A : *ExploredAreas)
		{
			if (FVector2D::Distance(A.Center, Pos) <= A.Radius) return true;
		}
		return false;
	}

	const FSpaceSystemShipView* OwnShip = nullptr;
	const TArray<FSpaceSystemPlanetView>* Planets = nullptr;
	const TArray<FSpaceSystemShipView>* Ships = nullptr;
	const TArray<FSpaceSystemExploredAreaView>* ExploredAreas = nullptr;
	FString ClientId;
};

void SSpaceSystemHUD::Construct(const FArguments& InArgs)
{
	OnTrade = InArgs._OnTrade;
	OnTravel = InArgs._OnTravel;
	OnSos = InArgs._OnSos;
	OnShareFuel = InArgs._OnShareFuel;
	OnBuyShip = InArgs._OnBuyShip;
	OnAcceptMission = InArgs._OnAcceptMission;

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
	return SNew(SBorder)
		.BorderImage(&PanelBrush)
		.BorderBackgroundColor(PanelBackground())
		.Padding(4.0f)
		[
			SAssignNew(MiniMapCanvas, SSpaceSystemMiniMapCanvas)
		];
}

void SSpaceSystemHUD::UpdateState(
	const FSpaceSystemShipView* OwnShip,
	const TArray<FSpaceSystemPlanetView>& Planets,
	const TArray<FSpaceSystemShipView>& Ships,
	const TArray<FSpaceSystemStoreView>& Stores,
	const TArray<FSpaceSystemExploredAreaView>& ExploredAreas,
	const TArray<FSpaceSystemSosSignalView>& SosSignals,
	const TArray<FSpaceSystemShipClassView>& ShipClasses,
	const TArray<FSpaceSystemMissionView>& Missions,
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
	CachedShipClasses = &ShipClasses;
	CachedMissions = &Missions;
	CachedConnectionStatus = ConnectionStatus;
	CachedHintText = HintText;
	CachedClientId = ClientId;
	CachedTick = Tick;

	// Update minimap
	if (MiniMapCanvas.IsValid())
	{
		MiniMapCanvas->SetData(OwnShip, &Planets, &Ships, &ExploredAreas, ClientId);
	}

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

	// Ship Dealer section
	if (CachedShipClasses && CachedShipClasses->Num() > 0)
	{
		static const TArray<FString> PurchasableIds = { TEXT("freightliner"), TEXT("yacht"), TEXT("fighter") };
		constexpr float ShipPurchaseCreditRate = 0.004f;

		MarketBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 12.0f, 0.0f, 4.0f)
		[
			SNew(STextBlock)
			.ColorAndOpacity(AccentColor)
			.Text(FText::FromString(TEXT("Ship Dealer")))
		];

		MarketBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 0.0f, 0.0f, 4.0f)
		[
			SNew(STextBlock)
			.ColorAndOpacity(DimTextColor)
			.Text(FText::FromString(FString::Printf(TEXT("Current ship: %s"), *CachedOwnShip->ShipClassLabel)))
		];

		for (const FSpaceSystemShipClassView& SC : *CachedShipClasses)
		{
			if (!PurchasableIds.Contains(SC.Id)) continue;
			const int32 Price = FMath::RoundToInt(SC.PriceEuro * ShipPurchaseCreditRate);
			const bool bCanAfford = CachedOwnShip->Credits >= static_cast<float>(Price);
			const FString ClassId = SC.Id;

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
					.Text(FText::FromString(FString::Printf(TEXT("%s  $%d  cargo:%d  spd:%.2f"), *SC.Label, Price, SC.CargoCapacity, SC.Speed)))
				]

				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.0f, 0.0f)
				[
					SNew(SButton)
					.IsEnabled(bCanAfford)
					.OnClicked_Lambda([this, ClassId]()
					{
						OnBuyShip.ExecuteIfBound(ClassId);
						return FReply::Handled();
					})
					[
						SNew(STextBlock).Text(FText::FromString(TEXT("Buy")))
					]
				]
			];
		}
	}

	// Mission Board section
	if (CachedMissions)
	{
		MarketBox->AddSlot()
		.AutoHeight()
		.Padding(0.0f, 12.0f, 0.0f, 4.0f)
		[
			SNew(STextBlock)
			.ColorAndOpacity(AccentColor)
			.Text(FText::FromString(TEXT("Mission Board")))
		];

		// Active missions
		bool bHasActive = false;
		for (const FSpaceSystemMissionView& Mission : *CachedMissions)
		{
			if (Mission.AcceptedByClientId != CachedClientId) continue;
			bHasActive = true;

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
					.ColorAndOpacity(FSlateColor(FLinearColor(0.45f, 0.88f, 0.69f)))
					.Text(FText::FromString(FString::Printf(TEXT("[Active] %s  (%d cr)"), *Mission.Title, Mission.Reward)))
				]
			];
		}

		// Available missions
		bool bHasAvailable = false;
		for (const FSpaceSystemMissionView& Mission : *CachedMissions)
		{
			if (!Mission.AcceptedByClientId.IsEmpty()) continue;
			bHasAvailable = true;
			const FString MissionId = Mission.Id;

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
					.Text(FText::FromString(FString::Printf(TEXT("%s  (%d cr, exp tick %d)"), *Mission.Title, Mission.Reward, Mission.ExpiresAtTick)))
				]

				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.0f, 0.0f)
				[
					SNew(SButton)
					.OnClicked_Lambda([this, MissionId]()
					{
						OnAcceptMission.ExecuteIfBound(MissionId);
						return FReply::Handled();
					})
					[
						SNew(STextBlock).Text(FText::FromString(TEXT("Accept")))
					]
				]
			];
		}

		if (!bHasActive && !bHasAvailable)
		{
			MarketBox->AddSlot()
			.AutoHeight()
			[
				SNew(STextBlock)
				.ColorAndOpacity(DimTextColor)
				.Text(FText::FromString(TEXT("No missions available")))
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
